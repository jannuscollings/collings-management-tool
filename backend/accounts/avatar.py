"""Validate and normalize small profile photos for durable database storage."""
from io import BytesIO
from pathlib import PurePath

from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
PHOTO_SIZE = (512, 512)
EXTENSIONS = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}


def normalized_photo(upload):
    if not upload or not upload.size or upload.size > MAX_UPLOAD_BYTES:
        raise ValidationError({"photo": "Choose an image up to 5 MB."})
    name = str(upload.name).replace("\\", "/").split("/")[-1]
    extension = PurePath(name).suffix.lower()
    expected = EXTENSIONS.get(extension)
    if not expected:
        raise ValidationError({"photo": "Use a JPEG, PNG, or WebP image."})
    try:
        raw = upload.read(MAX_UPLOAD_BYTES + 1)
        if len(raw) > MAX_UPLOAD_BYTES:
            raise ValidationError({"photo": "Choose an image up to 5 MB."})
        with Image.open(BytesIO(raw)) as image:
            if image.format != expected or image.width * image.height > MAX_IMAGE_PIXELS:
                raise ValueError("Image type or dimensions are invalid")
            image.verify()
        with Image.open(BytesIO(raw)) as image:
            image = ImageOps.exif_transpose(image)
            image.thumbnail(PHOTO_SIZE, Image.Resampling.LANCZOS)
            if image.mode != "RGB":
                canvas = Image.new("RGB", image.size, "white")
                if "A" in image.getbands():
                    canvas.paste(image, mask=image.getchannel("A"))
                else:
                    canvas.paste(image.convert("RGB"))
                image = canvas
            result = BytesIO()
            image.save(result, format="JPEG", quality=85, optimize=True)
            return result.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise ValidationError({"photo": "Choose a valid JPEG, PNG, or WebP image."})
