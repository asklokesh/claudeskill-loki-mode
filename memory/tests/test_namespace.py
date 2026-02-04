"""
Tests for Memory Namespace System (COMP-005)

Tests namespace-based project isolation including:
- Auto-detection from git, package.json, directory
- Namespace CRUD operations
- Namespace-scoped storage
- Cross-namespace retrieval
- Namespace inheritance
"""

import json
import os
import shutil
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add parent directory to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from memory.namespace import (
    NamespaceManager,
    NamespaceInfo,
    detect_namespace,
    DEFAULT_NAMESPACE,
    GLOBAL_NAMESPACE,
)
from memory.storage import MemoryStorage
from memory.retrieval import MemoryRetrieval


class TestNamespaceDetection(unittest.TestCase):
    """Test auto-detection of namespaces."""

    def setUp(self):
        """Set up test fixtures."""
        self.test_dir = tempfile.mkdtemp()
        self.manager = NamespaceManager(os.path.join(self.test_dir, "memory"))

    def tearDown(self):
        """Clean up test directory."""
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_detect_from_directory_name(self):
        """Test namespace detection from directory name."""
        # When there's no git or package.json, should use directory name
        namespace = self.manager.detect_namespace(self.test_dir)
        expected = os.path.basename(self.test_dir).lower()
        # Directory names from tempfile have mixed chars, sanitize expected
        expected_sanitized = self.manager._sanitize_namespace(expected)
        self.assertEqual(namespace, expected_sanitized)

    def test_detect_from_package_json(self):
        """Test namespace detection from package.json."""
        # Create package.json
        package_path = os.path.join(self.test_dir, "package.json")
        with open(package_path, "w") as f:
            json.dump({"name": "my-test-project"}, f)

        namespace = self.manager.detect_namespace(self.test_dir)
        self.assertEqual(namespace, "my-test-project")

    def test_detect_from_scoped_package(self):
        """Test namespace detection from scoped npm package."""
        package_path = os.path.join(self.test_dir, "package.json")
        with open(package_path, "w") as f:
            json.dump({"name": "@myorg/my-package"}, f)

        namespace = self.manager.detect_namespace(self.test_dir)
        self.assertEqual(namespace, "myorg-my-package")

    @patch("subprocess.run")
    def test_detect_from_git(self, mock_run):
        """Test namespace detection from git repository."""
        # Mock git commands
        def mock_git_command(args, **kwargs):
            result = MagicMock()
            if "rev-parse" in args:
                result.returncode = 0
                result.stdout = "/path/to/my-repo\n"
            elif "config" in args:
                result.returncode = 0
                result.stdout = "git@github.com:user/my-repo.git\n"
            return result

        mock_run.side_effect = mock_git_command

        namespace = self.manager.detect_namespace(self.test_dir)
        self.assertEqual(namespace, "my-repo")

    def test_sanitize_namespace(self):
        """Test namespace name sanitization."""
        test_cases = [
            ("My Project", "my-project"),
            ("test_repo", "test-repo"),
            ("@scope/package", "-scope-package"),
            ("name with  spaces", "name-with-spaces"),
            ("UPPERCASE", "uppercase"),
            ("special!@#chars", "special-chars"),
            ("", DEFAULT_NAMESPACE),
        ]
        for input_name, expected in test_cases:
            result = self.manager._sanitize_namespace(input_name)
            # Handle leading hyphen removal
            if expected.startswith("-"):
                expected = expected.lstrip("-")
            self.assertEqual(result, expected, f"Failed for input: {input_name}")


class TestNamespaceCRUD(unittest.TestCase):
    """Test namespace CRUD operations."""

    def setUp(self):
        """Set up test fixtures."""
        self.test_dir = tempfile.mkdtemp()
        self.base_path = os.path.join(self.test_dir, "memory")
        self.manager = NamespaceManager(self.base_path)

    def tearDown(self):
        """Clean up test directory."""
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_create_namespace(self):
        """Test creating a namespace."""
        info = self.manager.create_namespace(
            name="test-project",
            display_name="Test Project",
            description="A test project",
        )

        self.assertEqual(info.name, "test-project")
        self.assertEqual(info.display_name, "Test Project")
        self.assertEqual(info.description, "A test project")
        self.assertIsNotNone(info.created_at)

        # Check directory was created
        namespace_path = Path(self.base_path) / "test-project"
        self.assertTrue(namespace_path.exists())
        self.assertTrue((namespace_path / "episodic").exists())
        self.assertTrue((namespace_path / "semantic").exists())
        self.assertTrue((namespace_path / "skills").exists())

    def test_create_namespace_with_parent(self):
        """Test creating a namespace with parent."""
        # Create parent first
        self.manager.create_namespace(name="parent-project")

        # Create child
        child = self.manager.create_namespace(
            name="child-project",
            parent="parent-project",
        )

        self.assertEqual(child.parent, "parent-project")

    def test_create_duplicate_namespace_fails(self):
        """Test that creating duplicate namespace fails."""
        self.manager.create_namespace(name="test-project")

        with self.assertRaises(ValueError) as ctx:
            self.manager.create_namespace(name="test-project")

        self.assertIn("already exists", str(ctx.exception))

    def test_get_namespace(self):
        """Test getting a namespace by name."""
        self.manager.create_namespace(
            name="test-project",
            description="Test description",
        )

        info = self.manager.get_namespace("test-project")
        self.assertIsNotNone(info)
        self.assertEqual(info.name, "test-project")
        self.assertEqual(info.description, "Test description")

        # Non-existent namespace
        info = self.manager.get_namespace("nonexistent")
        self.assertIsNone(info)

    def test_list_namespaces(self):
        """Test listing all namespaces."""
        self.manager.create_namespace(name="project-a")
        self.manager.create_namespace(name="project-b")
        self.manager.create_namespace(name="project-c")

        namespaces = self.manager.list_namespaces()
        names = [ns.name for ns in namespaces]

        self.assertEqual(len(namespaces), 3)
        self.assertIn("project-a", names)
        self.assertIn("project-b", names)
        self.assertIn("project-c", names)

    def test_delete_namespace(self):
        """Test deleting a namespace."""
        self.manager.create_namespace(name="to-delete")

        result = self.manager.delete_namespace("to-delete")
        self.assertTrue(result)

        # Verify it's gone
        info = self.manager.get_namespace("to-delete")
        self.assertIsNone(info)

    def test_delete_namespace_with_data(self):
        """Test deleting namespace removes data when requested."""
        self.manager.create_namespace(name="with-data")

        # Add some test data
        namespace_path = Path(self.base_path) / "with-data"
        test_file = namespace_path / "episodic" / "test.json"
        with open(test_file, "w") as f:
            json.dump({"test": "data"}, f)

        # Delete without data (should keep files)
        result = self.manager.delete_namespace("with-data", delete_data=False)
        self.assertTrue(result)
        self.assertTrue(namespace_path.exists())

        # Re-create and delete with data
        self.manager.create_namespace(name="with-data-2")
        namespace_path_2 = Path(self.base_path) / "with-data-2"
        test_file_2 = namespace_path_2 / "episodic" / "test.json"
        with open(test_file_2, "w") as f:
            json.dump({"test": "data"}, f)

        result = self.manager.delete_namespace("with-data-2", delete_data=True)
        self.assertTrue(result)
        self.assertFalse(namespace_path_2.exists())

    def test_delete_namespace_with_children_fails(self):
        """Test that deleting namespace with children fails."""
        self.manager.create_namespace(name="parent")
        self.manager.create_namespace(name="child", parent="parent")

        with self.assertRaises(ValueError) as ctx:
            self.manager.delete_namespace("parent")

        self.assertIn("child namespaces", str(ctx.exception))


class TestNamespaceInheritance(unittest.TestCase):
    """Test namespace inheritance chain."""

    def setUp(self):
        """Set up test fixtures."""
        self.test_dir = tempfile.mkdtemp()
        self.base_path = os.path.join(self.test_dir, "memory")
        self.manager = NamespaceManager(self.base_path)

    def tearDown(self):
        """Clean up test directory."""
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_get_inheritance_chain(self):
        """Test getting inheritance chain."""
        # Create hierarchy: grandparent -> parent -> child
        self.manager.create_namespace(name="grandparent")
        self.manager.create_namespace(name="parent", parent="grandparent")
        self.manager.create_namespace(name="child", parent="parent")

        chain = self.manager.get_inheritance_chain("child")

        self.assertEqual(chain[0], "child")
        self.assertEqual(chain[1], "parent")
        self.assertEqual(chain[2], "grandparent")
        self.assertEqual(chain[-1], GLOBAL_NAMESPACE)

    def test_get_searchable_namespaces(self):
        """Test getting searchable namespaces."""
        self.manager.create_namespace(name="parent")
        self.manager.create_namespace(name="child", parent="parent")

        # With inheritance
        namespaces = self.manager.get_searchable_namespaces(
            "child",
            include_global=True,
            include_parents=True,
        )
        self.assertIn("child", namespaces)
        self.assertIn("parent", namespaces)
        self.assertIn(GLOBAL_NAMESPACE, namespaces)

        # Without inheritance
        namespaces = self.manager.get_searchable_namespaces(
            "child",
            include_global=False,
            include_parents=False,
        )
        self.assertEqual(namespaces, ["child"])


class TestNamespacedStorage(unittest.TestCase):
    """Test namespace-scoped storage operations."""

    def setUp(self):
        """Set up test fixtures."""
        self.test_dir = tempfile.mkdtemp()
        self.base_path = os.path.join(self.test_dir, "memory")

    def tearDown(self):
        """Clean up test directory."""
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_storage_with_namespace(self):
        """Test MemoryStorage with namespace."""
        storage = MemoryStorage(self.base_path, namespace="project-a")

        self.assertEqual(storage.namespace, "project-a")
        self.assertEqual(str(storage.base_path), os.path.join(self.base_path, "project-a"))

    def test_storage_without_namespace(self):
        """Test MemoryStorage without namespace (backward compat)."""
        storage = MemoryStorage(self.base_path)

        self.assertIsNone(storage.namespace)
        self.assertEqual(str(storage.base_path), self.base_path)

    def test_storage_switch_namespace(self):
        """Test switching namespace via with_namespace."""
        storage_a = MemoryStorage(self.base_path, namespace="project-a")
        storage_b = storage_a.with_namespace("project-b")

        self.assertEqual(storage_a.namespace, "project-a")
        self.assertEqual(storage_b.namespace, "project-b")
        self.assertNotEqual(str(storage_a.base_path), str(storage_b.base_path))

    def test_episode_isolation(self):
        """Test that episodes are isolated by namespace."""
        storage_a = MemoryStorage(self.base_path, namespace="project-a")
        storage_b = MemoryStorage(self.base_path, namespace="project-b")

        # Save episode to project-a
        episode_a = {
            "id": "test-episode-a",
            "task_id": "task-1",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "goal": "Test in project A",
        }
        storage_a.save_episode(episode_a)

        # Save episode to project-b
        episode_b = {
            "id": "test-episode-b",
            "task_id": "task-2",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "goal": "Test in project B",
        }
        storage_b.save_episode(episode_b)

        # Verify isolation
        episodes_a = storage_a.list_episodes()
        episodes_b = storage_b.list_episodes()

        self.assertEqual(len(episodes_a), 1)
        self.assertEqual(len(episodes_b), 1)
        self.assertIn("test-episode-a", episodes_a)
        self.assertIn("test-episode-b", episodes_b)

    def test_list_namespaces_from_storage(self):
        """Test listing namespaces from storage."""
        # Create storage in different namespaces
        MemoryStorage(self.base_path, namespace="project-a")
        MemoryStorage(self.base_path, namespace="project-b")

        # List from any storage instance
        storage = MemoryStorage(self.base_path)
        namespaces = storage.list_namespaces()

        self.assertIn("project-a", namespaces)
        self.assertIn("project-b", namespaces)

    def test_namespace_stats(self):
        """Test getting namespace statistics."""
        storage = MemoryStorage(self.base_path, namespace="test-project")

        # Add some data
        episode = {
            "id": "episode-1",
            "task_id": "task-1",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "goal": "Test episode",
        }
        storage.save_episode(episode)

        pattern = {
            "id": "pattern-1",
            "pattern": "Test pattern",
            "category": "testing",
        }
        storage.save_pattern(pattern)

        # Get stats
        stats = storage.get_namespace_stats()

        self.assertEqual(stats["namespace"], "test-project")
        self.assertEqual(stats["episode_count"], 1)
        self.assertEqual(stats["pattern_count"], 1)


class TestCrossNamespaceRetrieval(unittest.TestCase):
    """Test cross-namespace retrieval operations."""

    def setUp(self):
        """Set up test fixtures."""
        self.test_dir = tempfile.mkdtemp()
        self.base_path = os.path.join(self.test_dir, "memory")

        # Create storage instances for different namespaces
        self.storage_a = MemoryStorage(self.base_path, namespace="project-a")
        self.storage_b = MemoryStorage(self.base_path, namespace="project-b")

        # Add test data to each namespace
        self._add_test_data()

    def tearDown(self):
        """Clean up test directory."""
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def _add_test_data(self):
        """Add test data to both namespaces."""
        # Project A data
        episode_a = {
            "id": "episode-a-1",
            "task_id": "task-a-1",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "context": {
                "goal": "Implement feature in project A",
                "phase": "implementation",
            },
            "outcome": "success",
        }
        self.storage_a.save_episode(episode_a)

        pattern_a = {
            "id": "pattern-a-1",
            "pattern": "Project A pattern",
            "category": "coding",
            "confidence": 0.9,
        }
        self.storage_a.save_pattern(pattern_a)

        # Project B data
        episode_b = {
            "id": "episode-b-1",
            "task_id": "task-b-1",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "context": {
                "goal": "Debug issue in project B",
                "phase": "debugging",
            },
            "outcome": "success",
        }
        self.storage_b.save_episode(episode_b)

        pattern_b = {
            "id": "pattern-b-1",
            "pattern": "Project B pattern",
            "category": "debugging",
            "confidence": 0.85,
        }
        self.storage_b.save_pattern(pattern_b)

    def test_retrieve_from_single_namespace(self):
        """Test retrieval from a single namespace."""
        retrieval = MemoryRetrieval(
            storage=self.storage_a,
            base_path=self.base_path,
            namespace="project-a",
        )

        results = retrieval.retrieve_task_aware(
            context={"goal": "implement feature", "phase": "implementation"},
            top_k=10,
        )

        # Should only get project A results
        namespaces = {r.get("_namespace") for r in results if r.get("_namespace")}
        # Note: results may not have _namespace if from current namespace
        self.assertTrue(len(results) > 0)

    def test_retrieve_cross_namespace(self):
        """Test retrieval across multiple namespaces."""
        retrieval = MemoryRetrieval(
            storage=self.storage_a,
            base_path=self.base_path,
            namespace="project-a",
        )

        results = retrieval.retrieve_cross_namespace(
            context={"goal": "work on project", "phase": "implementation"},
            namespaces=["project-a", "project-b"],
            top_k=10,
        )

        # Should get results from both namespaces
        namespaces = {r.get("_namespace") for r in results}
        self.assertIn("project-a", namespaces)
        self.assertIn("project-b", namespaces)

    def test_search_all_namespaces(self):
        """Test searching across all namespaces."""
        retrieval = MemoryRetrieval(
            storage=self.storage_a,
            base_path=self.base_path,
            namespace="project-a",
        )

        # Mock list_namespaces on storage
        self.storage_a.list_namespaces = lambda: ["project-a", "project-b"]

        results = retrieval.search_all_namespaces(
            query="pattern",
            top_k=10,
        )

        # Should find patterns from both namespaces
        self.assertTrue(len(results) > 0)


class TestConvenienceFunctions(unittest.TestCase):
    """Test convenience functions."""

    def test_detect_namespace_function(self):
        """Test the standalone detect_namespace function."""
        # Should return something valid
        namespace = detect_namespace()
        self.assertIsInstance(namespace, str)
        self.assertTrue(len(namespace) > 0)


if __name__ == "__main__":
    unittest.main()
