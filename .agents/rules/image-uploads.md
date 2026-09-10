# Image Upload Standards

When implementing or modifying any image upload features in this project, you must enforce the following optimizations:

1. **HD Resolution Check**: All uploaded images must be scaled down to a maximum HD-friendly width (e.g. 1800px or 1920px) before being saved.
2. **WebP Formatting**: Always convert the uploaded image format to a `.webp` file (typically using a Canvas API with a quality like `0.85`) to save storage space and improve loading times.

Example reference implementations can be found in `app/admin/photo-gallery/page.tsx` or `app/admin/video-gallery/page.tsx`.
