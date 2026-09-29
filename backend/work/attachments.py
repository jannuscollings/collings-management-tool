"""Validation and private storage names for discussion attachments."""
import os
import unicodedata
import uuid
import zipfile

from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

MAX_FILES = 5
MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_TOTAL_SIZE = 25 * 1024 * 1024


def safe_filename(name):
    name = unicodedata.normalize("NFKC", str(name).replace("\\", "/").split("/")[-1])
    name = "".join(char for char in name if char.isprintable() and char not in "/\\")
    return (name.strip(" .") or "attachment")[:255]


def validate_files(files):
    if len(files) > MAX_FILES:
        raise ValidationError({"attachments": f"Attach at most {MAX_FILES} files."})
    if sum(file.size for file in files) > MAX_TOTAL_SIZE:
        raise ValidationError({"attachments": "Attachments exceed 25 MB combined."})
    result = []
    for file in files:
        if file.size > MAX_FILE_SIZE:
            raise ValidationError({"attachments": "Each attachment must be 10 MB or smaller."})
        if not file.size:
            raise ValidationError({"attachments": "Empty files are not supported."})
        filename = safe_filename(file.name)
        extension = os.path.splitext(filename)[1].lower()
        header = file.read(512)
        file.seek(0)
        content_type = None
        if extension in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
            formats = {".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG", ".gif": "GIF", ".webp": "WEBP"}
            try:
                with Image.open(file) as image:
                    image.verify()
                    if image.format != formats[extension]:
                        raise ValueError("Image type does not match its name")
            except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
                raise ValidationError({"attachments": "Invalid image file."})
            finally:
                file.seek(0)
            content_type = {"PNG": "image/png", "JPEG": "image/jpeg", "GIF": "image/gif", "WEBP": "image/webp"}[formats[extension]]
        elif extension == ".pdf" and header.startswith(b"%PDF-"):
            content_type = "application/pdf"
        elif extension == ".txt":
            try:
                file.read().decode("utf-8")
                content_type = "text/plain"
            except UnicodeDecodeError:
                pass
            finally:
                file.seek(0)
        elif extension in (".docx", ".xlsx", ".pptx"):
            roots = {".docx": "word/", ".xlsx": "xl/", ".pptx": "ppt/"}
            try:
                with zipfile.ZipFile(file) as archive:
                    names = set(archive.namelist())
                    if "[Content_Types].xml" in names and any(name.startswith(roots[extension]) for name in names):
                        content_type = {".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"}[extension]
            except (OSError, zipfile.BadZipFile):
                pass
            finally:
                file.seek(0)
        if not content_type:
            raise ValidationError({"attachments": "Unsupported or invalid file type."})
        result.append((file, filename, content_type, f"discussion/{uuid.uuid4().hex}{extension}"))
    return result
