# Missing Person Age Progression:
Generate age-progressed images for long-term missing persons cases with uncertainty visualization, aiding law enforcement and families in identification efforts.

<hr>

# Satellite Image Enhancement for Disaster Response
## Core Problem
After disasters (earthquakes, floods, hurricanes), satellite imagery is often degraded by cloud cover, smoke, debris, or sensor limitations. Emergency responders need clear, high-resolution imagery quickly to locate survivors, assess damage, and coordinate rescue efforts.

## Your Solution: A two-stage system:
### Diffusion Model
Super-resolves and denoises degraded satellite images
### Transformer
Analyzes enhanced images to detect and prioritize critical areas (collapsed buildings, blocked roads, potential survivor locations, accessible routes)

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