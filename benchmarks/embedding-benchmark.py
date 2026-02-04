#!/usr/bin/env python3
"""
Loki Mode Embedding Benchmark

Compares embedding providers across multiple dimensions:
- Retrieval quality (precision, recall)
- Latency
- Cost estimation
- Semantic similarity accuracy

Usage:
    python benchmarks/embedding-benchmark.py [--provider local|openai|cohere] [--output results.json]
"""

import argparse
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np

from memory.embeddings import (
    EmbeddingEngine,
    EmbeddingConfig,
    EmbeddingQuality,
    compute_quality_score,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# Benchmark Data
# -----------------------------------------------------------------------------

# Semantic similarity test pairs (text1, text2, expected_similar: bool)
SIMILARITY_PAIRS = [
    # Similar pairs
    ("The cat sat on the mat", "A feline rested on the rug", True),
    ("Python is a programming language", "Python is used for coding", True),
    ("Machine learning models predict outcomes", "ML algorithms make predictions", True),
    ("The weather is sunny today", "It's a bright and clear day", True),
    ("She walked to the store", "She strolled to the shop", True),

    # Dissimilar pairs
    ("The cat sat on the mat", "Bitcoin prices increased", False),
    ("Python is a programming language", "The cake was delicious", False),
    ("Machine learning models predict outcomes", "The car needs an oil change", False),
    ("The weather is sunny today", "Quantum physics is complex", False),
    ("She walked to the store", "The database query timed out", False),
]

# Retrieval benchmark corpus
RETRIEVAL_CORPUS = [
    # Technology category
    {"id": "tech-1", "text": "Python is a versatile programming language used for web development and data science.", "category": "technology"},
    {"id": "tech-2", "text": "Machine learning algorithms can identify patterns in large datasets.", "category": "technology"},
    {"id": "tech-3", "text": "Docker containers package applications with their dependencies.", "category": "technology"},
    {"id": "tech-4", "text": "Kubernetes orchestrates container deployments at scale.", "category": "technology"},
    {"id": "tech-5", "text": "REST APIs enable communication between web services.", "category": "technology"},

    # Science category
    {"id": "sci-1", "text": "Photosynthesis converts sunlight into chemical energy in plants.", "category": "science"},
    {"id": "sci-2", "text": "The human genome contains approximately 3 billion base pairs.", "category": "science"},
    {"id": "sci-3", "text": "Gravitational waves were first detected in 2015.", "category": "science"},
    {"id": "sci-4", "text": "Quantum entanglement allows particles to be correlated over distance.", "category": "science"},
    {"id": "sci-5", "text": "Climate change affects global weather patterns.", "category": "science"},

    # Business category
    {"id": "biz-1", "text": "Market research helps companies understand customer needs.", "category": "business"},
    {"id": "biz-2", "text": "Startup funding often comes from venture capital firms.", "category": "business"},
    {"id": "biz-3", "text": "Supply chain optimization reduces operational costs.", "category": "business"},
    {"id": "biz-4", "text": "Customer retention is key to sustainable growth.", "category": "business"},
    {"id": "biz-5", "text": "Agile methodology improves software development efficiency.", "category": "business"},
]

# Retrieval queries with expected top categories
RETRIEVAL_QUERIES = [
    {"query": "How do I build web applications with Python?", "expected_category": "technology"},
    {"query": "Neural networks for pattern recognition", "expected_category": "technology"},
    {"query": "Container orchestration platforms", "expected_category": "technology"},
    {"query": "How plants convert sunlight to energy", "expected_category": "science"},
    {"query": "DNA and genetic information", "expected_category": "science"},
    {"query": "How to raise money for a new company", "expected_category": "business"},
    {"query": "Improving customer loyalty programs", "expected_category": "business"},
]


# -----------------------------------------------------------------------------
# Benchmark Results
# -----------------------------------------------------------------------------

@dataclass
class SimilarityResult:
    """Result of similarity benchmark."""
    accuracy: float
    true_positives: int
    true_negatives: int
    false_positives: int
    false_negatives: int
    avg_similar_score: float
    avg_dissimilar_score: float
    threshold_used: float


@dataclass
class RetrievalResult:
    """Result of retrieval benchmark."""
    precision_at_1: float
    precision_at_3: float
    precision_at_5: float
    mrr: float  # Mean Reciprocal Rank
    category_accuracy: float


@dataclass
class LatencyResult:
    """Result of latency benchmark."""
    single_embed_ms: float
    batch_10_ms: float
    batch_100_ms: float
    similarity_search_ms: float


@dataclass
class QualityResult:
    """Result of embedding quality analysis."""
    avg_score: float
    avg_density: float
    avg_variance: float
    min_score: float
    max_score: float


@dataclass
class BenchmarkResult:
    """Complete benchmark results for a provider."""
    provider: str
    model: str
    dimension: int
    similarity: SimilarityResult
    retrieval: RetrievalResult
    latency: LatencyResult
    quality: QualityResult
    estimated_cost_per_1k: float  # USD per 1000 embeddings
    timestamp: str


# -----------------------------------------------------------------------------
# Benchmark Functions
# -----------------------------------------------------------------------------

def benchmark_similarity(engine: EmbeddingEngine) -> SimilarityResult:
    """
    Benchmark semantic similarity accuracy.

    Tests whether the embedding model correctly identifies
    similar and dissimilar text pairs.
    """
    logger.info("Running similarity benchmark...")

    similar_scores = []
    dissimilar_scores = []

    for text1, text2, expected_similar in SIMILARITY_PAIRS:
        emb1 = engine.embed(text1)
        emb2 = engine.embed(text2)
        score = engine.similarity(emb1, emb2)

        if expected_similar:
            similar_scores.append(score)
        else:
            dissimilar_scores.append(score)

    avg_similar = np.mean(similar_scores)
    avg_dissimilar = np.mean(dissimilar_scores)

    # Find optimal threshold
    threshold = (avg_similar + avg_dissimilar) / 2

    # Calculate metrics
    tp = sum(1 for s in similar_scores if s >= threshold)
    fn = sum(1 for s in similar_scores if s < threshold)
    tn = sum(1 for s in dissimilar_scores if s < threshold)
    fp = sum(1 for s in dissimilar_scores if s >= threshold)

    accuracy = (tp + tn) / (tp + tn + fp + fn) if (tp + tn + fp + fn) > 0 else 0

    return SimilarityResult(
        accuracy=accuracy,
        true_positives=tp,
        true_negatives=tn,
        false_positives=fp,
        false_negatives=fn,
        avg_similar_score=avg_similar,
        avg_dissimilar_score=avg_dissimilar,
        threshold_used=threshold,
    )


def benchmark_retrieval(engine: EmbeddingEngine) -> RetrievalResult:
    """
    Benchmark retrieval quality.

    Tests whether the embedding model retrieves relevant documents
    for given queries.
    """
    logger.info("Running retrieval benchmark...")

    # Build corpus embeddings
    corpus_texts = [doc["text"] for doc in RETRIEVAL_CORPUS]
    corpus_embeddings = engine.embed_batch(corpus_texts)

    precision_at_1_scores = []
    precision_at_3_scores = []
    precision_at_5_scores = []
    reciprocal_ranks = []
    category_correct = []

    for query_data in RETRIEVAL_QUERIES:
        query = query_data["query"]
        expected_category = query_data["expected_category"]

        query_emb = engine.embed(query)
        results = engine.similarity_search(query_emb, corpus_embeddings, top_k=5)

        # Get categories of top results
        result_categories = [RETRIEVAL_CORPUS[idx]["category"] for idx, _ in results]

        # Precision at K
        p1 = 1 if result_categories[0] == expected_category else 0
        p3 = sum(1 for c in result_categories[:3] if c == expected_category) / 3
        p5 = sum(1 for c in result_categories[:5] if c == expected_category) / 5

        precision_at_1_scores.append(p1)
        precision_at_3_scores.append(p3)
        precision_at_5_scores.append(p5)

        # MRR: find first correct result
        rr = 0
        for i, cat in enumerate(result_categories):
            if cat == expected_category:
                rr = 1 / (i + 1)
                break
        reciprocal_ranks.append(rr)

        # Category accuracy (top-1)
        category_correct.append(1 if result_categories[0] == expected_category else 0)

    return RetrievalResult(
        precision_at_1=np.mean(precision_at_1_scores),
        precision_at_3=np.mean(precision_at_3_scores),
        precision_at_5=np.mean(precision_at_5_scores),
        mrr=np.mean(reciprocal_ranks),
        category_accuracy=np.mean(category_correct),
    )


def benchmark_latency(engine: EmbeddingEngine) -> LatencyResult:
    """
    Benchmark embedding latency.

    Measures time for single and batch embedding operations.
    """
    logger.info("Running latency benchmark...")

    test_text = "This is a test sentence for latency benchmarking."
    test_texts_10 = [f"Test sentence number {i} for batch benchmarking." for i in range(10)]
    test_texts_100 = [f"Test sentence number {i} for larger batch benchmarking." for i in range(100)]

    # Clear cache for fair measurement
    engine.clear_cache()

    # Single embedding
    times = []
    for _ in range(10):
        engine.clear_cache()
        start = time.time()
        engine.embed(test_text)
        times.append((time.time() - start) * 1000)
    single_ms = np.mean(times)

    # Batch of 10
    engine.clear_cache()
    start = time.time()
    engine.embed_batch(test_texts_10)
    batch_10_ms = (time.time() - start) * 1000

    # Batch of 100
    engine.clear_cache()
    start = time.time()
    engine.embed_batch(test_texts_100)
    batch_100_ms = (time.time() - start) * 1000

    # Similarity search
    corpus = engine.embed_batch([doc["text"] for doc in RETRIEVAL_CORPUS])
    query = engine.embed(test_text)

    times = []
    for _ in range(100):
        start = time.time()
        engine.similarity_search(query, corpus, top_k=5)
        times.append((time.time() - start) * 1000)
    search_ms = np.mean(times)

    return LatencyResult(
        single_embed_ms=single_ms,
        batch_10_ms=batch_10_ms,
        batch_100_ms=batch_100_ms,
        similarity_search_ms=search_ms,
    )


def benchmark_quality(engine: EmbeddingEngine) -> QualityResult:
    """
    Benchmark embedding quality metrics.

    Analyzes quality scores across the test corpus.
    """
    logger.info("Running quality benchmark...")

    qualities = []
    for doc in RETRIEVAL_CORPUS:
        _, quality = engine.embed_with_quality(doc["text"])
        qualities.append(quality)

    scores = [q.score for q in qualities]
    densities = [q.density for q in qualities]
    variances = [q.variance for q in qualities]

    return QualityResult(
        avg_score=np.mean(scores),
        avg_density=np.mean(densities),
        avg_variance=np.mean(variances),
        min_score=min(scores),
        max_score=max(scores),
    )


def estimate_cost(provider: str, model: str) -> float:
    """
    Estimate cost per 1000 embeddings in USD.

    Based on published pricing as of early 2026.
    """
    # Approximate costs (update as pricing changes)
    costs = {
        "local": 0.0,  # Free
        "openai": {
            "text-embedding-3-small": 0.02,  # $0.00002 per 1K tokens, avg 250 tokens
            "text-embedding-3-large": 0.13,  # $0.00013 per 1K tokens
            "text-embedding-ada-002": 0.10,
        },
        "cohere": {
            "embed-english-v3.0": 0.10,  # $0.0001 per embedding
            "embed-english-light-v3.0": 0.02,
            "embed-multilingual-v3.0": 0.10,
        },
    }

    if provider == "local":
        return 0.0

    provider_costs = costs.get(provider, {})
    return provider_costs.get(model, 0.10)  # Default estimate


def run_benchmark(provider: str, model: Optional[str] = None) -> BenchmarkResult:
    """
    Run complete benchmark suite for a provider.
    """
    logger.info(f"Running benchmark for provider: {provider}")

    # Create engine with specified provider
    config = EmbeddingConfig(
        provider=provider,
        model=model,
        cache_enabled=False,  # Disable caching for fair benchmarks
    )

    engine = EmbeddingEngine(config=config)

    actual_provider = engine.get_provider_name()
    actual_model = engine.model_name

    if actual_provider != provider:
        logger.warning(f"Requested {provider} but using {actual_provider} (fallback)")

    # Run all benchmarks
    similarity = benchmark_similarity(engine)
    retrieval = benchmark_retrieval(engine)
    latency = benchmark_latency(engine)
    quality = benchmark_quality(engine)
    cost = estimate_cost(actual_provider, actual_model)

    return BenchmarkResult(
        provider=actual_provider,
        model=actual_model,
        dimension=engine.get_dimension(),
        similarity=similarity,
        retrieval=retrieval,
        latency=latency,
        quality=quality,
        estimated_cost_per_1k=cost,
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


def print_results(result: BenchmarkResult) -> None:
    """Print benchmark results in a readable format."""
    print("\n" + "=" * 60)
    print(f"Benchmark Results: {result.provider} ({result.model})")
    print("=" * 60)

    print(f"\nProvider: {result.provider}")
    print(f"Model: {result.model}")
    print(f"Dimension: {result.dimension}")
    print(f"Timestamp: {result.timestamp}")

    print("\n--- Similarity Benchmark ---")
    sim = result.similarity
    print(f"Accuracy: {sim.accuracy:.1%}")
    print(f"True Positives: {sim.true_positives}, True Negatives: {sim.true_negatives}")
    print(f"False Positives: {sim.false_positives}, False Negatives: {sim.false_negatives}")
    print(f"Avg Similar Score: {sim.avg_similar_score:.4f}")
    print(f"Avg Dissimilar Score: {sim.avg_dissimilar_score:.4f}")
    print(f"Optimal Threshold: {sim.threshold_used:.4f}")

    print("\n--- Retrieval Benchmark ---")
    ret = result.retrieval
    print(f"Precision@1: {ret.precision_at_1:.1%}")
    print(f"Precision@3: {ret.precision_at_3:.1%}")
    print(f"Precision@5: {ret.precision_at_5:.1%}")
    print(f"MRR: {ret.mrr:.4f}")
    print(f"Category Accuracy: {ret.category_accuracy:.1%}")

    print("\n--- Latency Benchmark ---")
    lat = result.latency
    print(f"Single Embed: {lat.single_embed_ms:.2f} ms")
    print(f"Batch 10: {lat.batch_10_ms:.2f} ms ({lat.batch_10_ms/10:.2f} ms/item)")
    print(f"Batch 100: {lat.batch_100_ms:.2f} ms ({lat.batch_100_ms/100:.2f} ms/item)")
    print(f"Similarity Search: {lat.similarity_search_ms:.4f} ms")

    print("\n--- Quality Metrics ---")
    qual = result.quality
    print(f"Avg Quality Score: {qual.avg_score:.4f}")
    print(f"Avg Density: {qual.avg_density:.4f}")
    print(f"Avg Variance: {qual.avg_variance:.6f}")
    print(f"Score Range: [{qual.min_score:.4f}, {qual.max_score:.4f}]")

    print("\n--- Cost Estimate ---")
    print(f"Estimated Cost: ${result.estimated_cost_per_1k:.4f} per 1K embeddings")

    print("\n" + "=" * 60)


def compare_providers(providers: List[str]) -> Dict[str, BenchmarkResult]:
    """Run benchmarks for multiple providers and compare."""
    results = {}

    for provider in providers:
        try:
            result = run_benchmark(provider)
            results[provider] = result
            print_results(result)
        except Exception as e:
            logger.error(f"Failed to benchmark {provider}: {e}")

    # Print comparison summary
    if len(results) > 1:
        print("\n" + "=" * 60)
        print("COMPARISON SUMMARY")
        print("=" * 60)
        print(f"\n{'Provider':<15} {'Accuracy':<10} {'P@1':<10} {'Latency':<12} {'Cost/1K':<10}")
        print("-" * 60)

        for provider, result in results.items():
            print(
                f"{provider:<15} "
                f"{result.similarity.accuracy:.1%}     "
                f"{result.retrieval.precision_at_1:.1%}     "
                f"{result.latency.single_embed_ms:.1f} ms    "
                f"${result.estimated_cost_per_1k:.4f}"
            )

    return results


def main():
    parser = argparse.ArgumentParser(description="Loki Mode Embedding Benchmark")
    parser.add_argument(
        "--provider",
        choices=["local", "openai", "cohere", "all"],
        default="local",
        help="Provider to benchmark (default: local)"
    )
    parser.add_argument(
        "--model",
        help="Specific model to use (optional)"
    )
    parser.add_argument(
        "--output",
        help="Output file for JSON results (optional)"
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Compare all available providers"
    )

    args = parser.parse_args()

    if args.compare or args.provider == "all":
        # Compare all providers
        providers = ["local"]

        # Check for API keys
        if os.environ.get("OPENAI_API_KEY"):
            providers.append("openai")
        if os.environ.get("COHERE_API_KEY"):
            providers.append("cohere")

        results = compare_providers(providers)

        if args.output:
            output_data = {p: asdict(r) for p, r in results.items()}
            with open(args.output, "w") as f:
                json.dump(output_data, f, indent=2)
            logger.info(f"Results saved to {args.output}")
    else:
        # Single provider benchmark
        result = run_benchmark(args.provider, args.model)
        print_results(result)

        if args.output:
            with open(args.output, "w") as f:
                json.dump(asdict(result), f, indent=2)
            logger.info(f"Results saved to {args.output}")


if __name__ == "__main__":
    main()
