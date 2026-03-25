"""Checkout Champ seed script disabled.

Checkout Champ integration has been removed in favor of TagadaPay. This
script used to seed example CHECKOUTCHAMP_* values into the DB; it is now
disabled to avoid accidental use. If you need to seed TagadaPay config, use
the `scripts/seed_demo_data.py` or create the config entries manually.
"""


def main():
    raise RuntimeError(
        "Checkout Champ seed removed. Use TagadaPay setup instructions instead."
    )


if __name__ == "__main__":
    main()
