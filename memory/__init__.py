# Loki Mode Memory System
# Core data schemas and engine for episodic, semantic, and procedural memory.
# Supports namespace-based project isolation (v5.19.0).

# Embeddings module requires numpy - make it optional
try:
    from .embeddings import (
        EmbeddingEngine,
        EmbeddingConfig,
        EmbeddingProvider,
        EmbeddingQuality,
        ChunkingStrategy,
        TextChunker,
        quick_similarity,
        create_config_file,
        compute_quality_score,
    )
    _EMBEDDINGS_AVAILABLE = True
except ImportError:
    # numpy not installed - embeddings not available
    EmbeddingEngine = None
    EmbeddingConfig = None
    EmbeddingProvider = None
    EmbeddingQuality = None
    ChunkingStrategy = None
    TextChunker = None
    quick_similarity = None
    create_config_file = None
    compute_quality_score = None
    _EMBEDDINGS_AVAILABLE = False

from .schemas import (
    ActionEntry,
    ErrorEntry,
    Link,
    ErrorFix,
    TaskContext,
    EpisodeTrace,
    SemanticPattern,
    ProceduralSkill,
)

from .storage import MemoryStorage, DEFAULT_NAMESPACE

from .engine import (
    MemoryEngine,
    EpisodicMemory,
    SemanticMemory,
    ProceduralMemory,
    TASK_STRATEGIES,
)

from .retrieval import (
    MemoryRetrieval,
    TASK_STRATEGIES as RETRIEVAL_TASK_STRATEGIES,
    TASK_SIGNALS,
)

from .token_economics import (
    TokenEconomics,
    THRESHOLDS,
    Action,
    estimate_tokens,
    estimate_memory_tokens,
    estimate_full_load_tokens,
)

from .consolidation import (
    ConsolidationPipeline,
    ConsolidationResult,
    Cluster,
    compress_episode_to_summary,
    compress_episodes_to_pattern_desc,
)

from .unified_access import (
    UnifiedMemoryAccess,
    MemoryContext,
)

from .namespace import (
    NamespaceManager,
    NamespaceInfo,
    detect_namespace,
    DEFAULT_NAMESPACE as NS_DEFAULT,
    GLOBAL_NAMESPACE,
)

__all__ = [
    # Embeddings
    "EmbeddingEngine",
    "EmbeddingConfig",
    "EmbeddingProvider",
    "EmbeddingQuality",
    "ChunkingStrategy",
    "TextChunker",
    "quick_similarity",
    "create_config_file",
    "compute_quality_score",
    # Schemas
    "ActionEntry",
    "ErrorEntry",
    "Link",
    "ErrorFix",
    "TaskContext",
    "EpisodeTrace",
    "SemanticPattern",
    "ProceduralSkill",
    # Engine
    "MemoryStorage",
    "MemoryEngine",
    "EpisodicMemory",
    "SemanticMemory",
    "ProceduralMemory",
    "TASK_STRATEGIES",
    # Retrieval
    "MemoryRetrieval",
    "RETRIEVAL_TASK_STRATEGIES",
    "TASK_SIGNALS",
    # Token Economics
    "TokenEconomics",
    "THRESHOLDS",
    "Action",
    "estimate_tokens",
    "estimate_memory_tokens",
    "estimate_full_load_tokens",
    # Consolidation
    "ConsolidationPipeline",
    "ConsolidationResult",
    "Cluster",
    "compress_episode_to_summary",
    "compress_episodes_to_pattern_desc",
    # Unified Access
    "UnifiedMemoryAccess",
    "MemoryContext",
    # Namespace (v5.19.0)
    "NamespaceManager",
    "NamespaceInfo",
    "detect_namespace",
    "DEFAULT_NAMESPACE",
    "GLOBAL_NAMESPACE",
]
