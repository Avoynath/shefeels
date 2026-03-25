# app/core/templates.py  (one-liner singleton)
from fastapi.templating import Jinja2Templates
import pathlib

BASE_DIR = pathlib.Path(__file__).parent.parent  # adjust as needed
templates = Jinja2Templates(directory=BASE_DIR / "templates")
