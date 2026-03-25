"""
Unified script to create ALL pre-built characters from CSV.

Supports:
- Male, Female, Transgender, Nonbinary (no skipping).
- Realistic + Anime styles (including trans anime).
- Correct body attributes:
  * Cis male   -> dick_size only
  * Cis female -> breast_size + butt_size
  * Trans/NB   -> breast_size, butt_size, dick_size all taken independently from CSV

Style detection:
- First uses `Type` column if it contains 'anime'
- Otherwise, falls back to `Source_Sheet` (or `Sheet`) containing 'anime'
- Default is 'realistic'

Assumptions:
- Backend at http://localhost:8000/api/v1
- Endpoint: POST /characters/create
- Auth login: POST /auth/login
- CSV file: combined_characters_updated.csv (fallback: combined_characters.csv) (with columns like:
  Name, Gender, Age, Ethnicity/Race, Eye Colour, Hair Style, Hair Colour,
  Body Type, Breast Size, Butt Size, Dick Size, Personality, Background,
  Relationship, Voice, Clothes/Cothes, Special Feature, Type, Source_Sheet, ...
)
"""

import asyncio
import aiohttp
import csv
import random
import sys
from pathlib import Path
from typing import Dict, List, Optional

# ---------------- CONFIG ----------------

API_BASE_URL = "http://localhost:8000/api/v1"

# 👉 Point this to your final CSV (change if needed). We try updated first, then fallback.
CSV_FILE_CANDIDATES = [
    Path(__file__).parent.parent / "dummy.csv",
    Path(__file__).parent.parent / "dummy.csv",
]


def resolve_csv_path() -> Optional[Path]:
    """Return the first existing CSV path from the candidate list, or None."""
    for path in CSV_FILE_CANDIDATES:
        if path.exists():
            return path
    return None

ADMIN_EMAIL = "admin@tripleminds.co"
ADMIN_PASSWORD = "admin1234"

RELATIONSHIPS = [
    "Stranger",
    "Schoolmate",
    "Colleague",
    "Mentor",
    "Girlfriend",
    "Sex Friend",
    "Wife",
    "Mistress",
    "Friend",
]

VOICES = ["Emotive", "Caring", "Naughty", "Flirty", "Addictive", "Love", "Dominating"]

FEMALE_BREAST_SIZES = ["flat", "small", "medium", "large", "xl"]
FEMALE_BUTT_SIZES = ["small", "medium", "large", "athletic"]
MALE_DICK_SIZES = ["small", "medium", "large", "huge"]


# ---------------- HELPERS ----------------


def first_non_empty(row: Dict, keys: List[str]) -> str:
    """Return the first non-empty string value for any of the given keys in a CSV row."""
    for key in keys:
        if key in row and row[key] is not None:
            value = str(row[key]).strip()
            if value:
                return value
    return ""


def normalize_breast_size(raw: str) -> Optional[str]:
    v = (raw or "").strip().lower()
    if not v:
        return None
    if v in FEMALE_BREAST_SIZES:
        return v
    if "flat" in v:
        return "flat"
    if "small" in v:
        return "small"
    if "medium" in v or "avg" in v:
        return "medium"
    if "large" in v or "big" in v:
        return "large"
    if "xl" in v:
        return "xl"
    return None


def normalize_butt_size(raw: str) -> Optional[str]:
    v = (raw or "").strip().lower()
    if not v:
        return None
    if v in FEMALE_BUTT_SIZES:
        return v
    if "small" in v:
        return "small"
    if "medium" in v or "avg" in v:
        return "medium"
    if "large" in v or "big" in v:
        return "large"
    if "athlet" in v:  # athletic / athlete
        return "athletic"
    return None


def normalize_dick_size(raw: str) -> Optional[str]:
    v = (raw or "").strip().lower()
    if not v:
        return None
    if v in MALE_DICK_SIZES:
        return v
    if "small" in v:
        return "small"
    if "medium" in v or "avg" in v:
        return "medium"
    if "large" in v or "big" in v:
        return "large"
    if "huge" in v:
        return "huge"
    return None


def infer_style(row: Dict) -> str:
    """
    Infer style = 'anime' or 'realistic' from row.
    Priority:
    1) Type column
    2) Source_Sheet / Sheet column
    Default: 'realistic'
    """
    type_raw = (row.get("Type") or "").strip().lower()
    source_raw = (row.get("Source_Sheet") or row.get("Sheet") or "").strip().lower()

    if "anime" in type_raw or "anime" in source_raw:
        return "anime"
    return "realistic"


def is_trans_gender(gender: str) -> bool:
    g = (gender or "").strip().lower()
    return (
        "transgender" in g
        or "trans" in g
        or "nonbinary" in g
        or "non-binary" in g
        or "nb" == g
    )


def classify_cis_gender(gender: str) -> str:
    """
    For non-trans entries:
    - return 'male' if clearly male
    - otherwise 'female' by default
    """
    g = (gender or "").strip().lower()
    if "male" in g and "female" not in g:
        return "male"
    # default: female for everything else (Female, Woman, Girl, etc.)
    return "female"


# ---------------- MAIN CLASS ----------------


class CharacterCreator:
    def __init__(self):
        self.auth_token: Optional[str] = None
        self.session: Optional[aiohttp.ClientSession] = None
        self.created_count = 0
        self.failed_count = 0
        self.failed_characters: List[Dict] = []

    # ---------- AUTH ----------

    async def login(self) -> bool:
        """Login and get authentication token."""
        login_url = f"{API_BASE_URL}/auth/login"
        login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(login_url, json=login_data) as response:
                    if response.status == 200:
                        data = await response.json()
                        self.auth_token = data.get("access_token")
                        print(f"✓ Successfully logged in as {ADMIN_EMAIL}")
                        return True
                    else:
                        error_text = await response.text()
                        print(f"✗ Login failed: {response.status} - {error_text}")
                        return False
        except Exception as e:
            print(f"✗ Login error: {str(e)}")
            return False

    # ---------- CSV READ ----------

    def parse_csv(self) -> List[Dict]:
        """Parse CSV file and return list of ALL character rows."""
        characters: List[Dict] = []

        csv_path = resolve_csv_path()
        if not csv_path:
            tried_paths = ", ".join(str(p) for p in CSV_FILE_CANDIDATES)
            print(f"バ- Error parsing CSV: no CSV file found. Tried: {tried_paths}")
            return []
        print(f"✓ Using CSV file: {csv_path}")

        def read_with_encoding(encoding: str) -> List[Dict]:
            local: List[Dict] = []
            with open(csv_path, "r", encoding=encoding, errors="replace") as file:
                reader = csv.DictReader(file)
                for row in reader:
                    # keep everyone: cis + trans + anime + realistic
                    local.append(row)
            return local

        try:
            try:
                characters = read_with_encoding("utf-8-sig")
            except UnicodeDecodeError:
                characters = read_with_encoding("cp1252")

            print(f"✓ Parsed {len(characters)} characters from {csv_path.name}")
            return characters
        except Exception as e:
            print(f"✗ Error parsing CSV: {str(e)}")
            return []

    # ---------- MAPPING ----------

    def map_character_data(self, row: Dict) -> Dict:
        """Map CSV row data to API character creation payload."""

        name = (row.get("Name") or "").strip()
        gender = (row.get("Gender") or "Female").strip()
        gender_lower = gender.lower()

        # Trans / NB flag
        is_trans = is_trans_gender(gender)
        # Cis classification used only when not trans
        cis_kind = classify_cis_gender(gender) if not is_trans else None

        # Age
        age_raw = (row.get("Age") or "").strip()
        try:
            age = int(age_raw) if age_raw else 25
        except ValueError:
            age = 25

        # Bio
        bio = (row.get("Bio") or "").strip()
        if not bio:
            bio = f"A {age} year old {gender.lower()} character."

        # Ethnicity / Race
        ethnicity = row.get("Ethnicity") or row.get("Race") or "Caucasian"
        ethnicity = ethnicity.strip()

        eye_colour = first_non_empty(row, ["Eye Colour"]) or "Brown"
        hair_style = (row.get("Hair Style") or "Long").strip()
        hair_colour = (row.get("Hair Colour") or "Brown").strip()
        body_type = (row.get("Body Type") or "Average").strip()

        personality = (row.get("Personality") or "Friendly and engaging").strip()
        background = (row.get("Background") or "").strip()
        if not background:
            background = personality

        relationship = (row.get("Relationship") or "").strip()
        if not relationship:
            relationship = random.choice(RELATIONSHIPS)

        voice_raw = (row.get("Voice") or "").strip()
        if not voice_raw:
            voice_raw = random.choice(VOICES)
        voice_type = voice_raw.capitalize()

        clothes = (
            row.get("Clothes") or row.get("Cothes") or "Casual wear"  # typo fallback
        ).strip()
        special_feature = (
            row.get("Special Feature") or row.get("Special feature") or ""
        ).strip()

        # ----- BODY ATTRIBUTES -----
        if is_trans:
            # Trans / nonbinary: all three attributes are allowed independently
            breast_size = normalize_breast_size(row.get("Breast Size", ""))
            butt_size = normalize_butt_size(row.get("Butt Size", ""))
            dick_size = normalize_dick_size(row.get("Dick Size", ""))
        else:
            if cis_kind == "male":
                # Cis male: dick only
                dick_size = normalize_dick_size(row.get("Dick Size", ""))
                breast_size = None
                butt_size = None
            else:
                # Cis female: breast + butt
                breast_size = normalize_breast_size(row.get("Breast Size", ""))
                butt_size = normalize_butt_size(row.get("Butt Size", ""))
                dick_size = None

        # ----- STYLE (ANIME vs REALISTIC) -----
        style = infer_style(row)  # "anime" or "realistic"

        character_data: Dict = {
            "username": name.lower().replace(" ", "-"),
            "name": name,
            "bio": bio,
            "gender": gender,
            "style": style,
            "ethnicity": ethnicity,
            "age": age,
            "eye_colour": eye_colour,
            "hair_style": hair_style,
            "hair_colour": hair_colour,
            "body_type": body_type,
            "personality": personality,
            "voice_type": voice_type,
            "relationship_type": relationship,
            "clothing": clothes,
            "special_features": special_feature,
            "background": background,
            "privacy": "public",
            "enhanced_prompt": False,
            "breast_size": breast_size,
            "butt_size": butt_size,
            "dick_size": dick_size,
        }

        return character_data

    # ---------- API CALL ----------

    async def create_character(self, character_data: Dict) -> bool:
        """Create a single character via API."""
        create_url = f"{API_BASE_URL}/characters/create"
        headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json",
        }

        try:
            async with self.session.post(
                create_url,
                json=character_data,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=120),
            ) as response:
                if response.status == 200:
                    await response.json()
                    print(
                        f"✓ Created: {character_data['name']} "
                        f"({character_data['gender']}, {character_data['style']})"
                    )
                    self.created_count += 1
                    return True
                else:
                    error_text = await response.text()
                    print(
                        f"✗ Failed to create {character_data['name']}: "
                        f"{response.status} - {error_text}"
                    )
                    self.failed_count += 1
                    self.failed_characters.append(
                        {
                            "name": character_data["name"],
                            "error": f"{response.status} - {error_text}",
                        }
                    )
                    return False
        except asyncio.TimeoutError:
            print(f"✗ Timeout creating {character_data['name']}")
            self.failed_count += 1
            self.failed_characters.append(
                {"name": character_data["name"], "error": "Timeout"}
            )
            return False
        except Exception as e:
            print(f"✗ Error creating {character_data['name']}: {str(e)}")
            self.failed_count += 1
            self.failed_characters.append(
                {"name": character_data["name"], "error": str(e)}
            )
            return False

    # ---------- BATCH CREATION ----------

    async def create_characters_parallel(
        self, characters_data: List[Dict], batch_size: int = 5
    ):
        """Create multiple characters in parallel with batching."""
        print(f"\n🚀 Starting character creation (batch size: {batch_size})...")
        print(f"Total characters to create: {len(characters_data)}\n")

        connector = aiohttp.TCPConnector(limit=batch_size)
        self.session = aiohttp.ClientSession(connector=connector)

        try:
            for i in range(0, len(characters_data), batch_size):
                batch = characters_data[i : i + batch_size]
                print(
                    f"\n--- Processing batch {i // batch_size + 1} "
                    f"({i + 1}-{min(i + batch_size, len(characters_data))} "
                    f"of {len(characters_data)}) ---"
                )

                tasks = [self.create_character(char_data) for char_data in batch]
                await asyncio.gather(*tasks, return_exceptions=True)

                if i + batch_size < len(characters_data):
                    await asyncio.sleep(2)
        finally:
            await self.session.close()

    # ---------- MAIN FLOW ----------

    async def run(self, batch_size: int = 5):
        print("=" * 60)
        print("Pre-Built Character Creator (Cis + Trans, Realistic + Anime)")
        print("=" * 60)

        print("\n[1/4] Authenticating...")
        if not await self.login():
            print("\n✗ Failed to authenticate. Exiting.")
            return

        print("\n[2/4] Parsing CSV file...")
        csv_data = self.parse_csv()
        if not csv_data:
            print("\n✗ No character data found. Exiting.")
            return

        print("\n[3/4] Mapping character data...")
        characters_data = [self.map_character_data(row) for row in csv_data]
        print(f"✓ Mapped {len(characters_data)} characters")

        print("\n[4/4] Creating characters...")
        await self.create_characters_parallel(characters_data, batch_size=batch_size)

        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        print(f"✓ Successfully created: {self.created_count}")
        print(f"✗ Failed: {self.failed_count}")

        if self.failed_characters:
            print("\nFailed characters:")
            for failed in self.failed_characters:
                print(f"  - {failed['name']}: {failed['error']}")

        print("\n✓ Process completed!")


# -------------- ENTRY POINT --------------


async def main():
    batch_size = 1  # start safe; pass higher via CLI if you want

    if len(sys.argv) > 1:
        try:
            batch_size = int(sys.argv[1])
        except ValueError:
            print(f"Invalid batch size: {sys.argv[1]}, using default: 1")

    creator = CharacterCreator()
    await creator.run(batch_size=batch_size)


if __name__ == "__main__":
    asyncio.run(main())
