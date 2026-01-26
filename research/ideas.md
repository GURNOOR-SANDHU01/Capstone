# 1. Missing Person Age Progression:

Generate age-progressed images for long-term missing persons cases with uncertainty visualization, aiding law enforcement and families in identification efforts.

<hr>

# 2. Satellite Image Enhancement for Disaster Response

## Core Problem

After disasters (earthquakes, floods, hurricanes), satellite imagery is often degraded by cloud cover, smoke, debris, or sensor limitations. Emergency responders need clear, high-resolution imagery quickly to locate survivors, assess damage, and coordinate rescue efforts.

## Your Solution: A two-stage system:

### Diffusion Model

Super-resolves and denoises degraded satellite images

### Transformer

Analyzes enhanced images to detect and prioritize critical areas (collapsed buildings, blocked roads, potential survivor locations, accessible routes)

## Technical architecture

### stage 1: image enhancement

- Input: Low-resolution, noisy, or partially obscured satellite imagery
- Diffusion Model Approach:
    - Train a conditional diffusion model (like SR3 or Stable Diffusion fine-tuned) for super-resolution
    - Condition on degradation type (clouds, smoke, low-res)
    - Output: 4x or 8x resolution enhancement with noise removal

### stage 2: contextual analysis

- Transformer Component
    - Vision Transformer (ViT) or Swin Transformer for image understanding
    - Segment and classify: buildings (intact/damaged), roads (clear/blocked), water bodies, vegetation
    - Priority Mapping: Generate heatmaps showing highest-priority search areas based on building collapse likelihood, population density estimates, accessibility via roads, time since disaster

## Tech Stack

- PyTorch / TensorFlow
- Diffusers (Hugging Face) - pre-built diffusion models
- Transformers (Hugging Face) - vision transformers
- Rasterio / GDAL - geospatial data handling
- Segmentation Models PyTorch
- Stable Diffusion (fine-tune for satellite)
- Swin Transformer for segmentation
- CLIP for zero-shot classification
- SAM (Segment Anything Model) for object detection

## Data sources

### for training enhancement models

- https://spacenet.ai/datasets/
- https://xview2.org/dataset
- https://www.maxar.com/open-data
- https://emergency.copernicus.eu/
- https://disasters.nasa.gov/

### for synthetic degradation

- Sentinel-2: to create paired high-res/low-res training data. https://scihub.copernicus.eu/
- Google Earth Engine: Programmatic access to massive satellite archives. https://earthengine.google.com/
