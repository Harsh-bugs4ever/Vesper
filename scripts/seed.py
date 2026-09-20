"""Seed the demo resort.

Builds JW Marriott Mumbai, Juhu as a simulated property: rooms, staff, menu, stock,
assets with a year of sensor history, and enough booking history for the demand engine
to have something real to fit.

Everything here is fabricated. No real guest, booking, employee or revenue figure
appears in this repository.

Run: python scripts/seed.py [--reset]
"""
from __future__ import annotations

import argparse
import itertools
import random
import secrets
import sys
from uuid import uuid4
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))

from sqlalchemy import text  # noqa: E402

from vesper_common.clock import property_tz, utcnow  # noqa: E402
from vesper_common.db import SCHEMAS, Base, get_engine, import_all_models, session_scope  # noqa: E402
from vesper_common.security import hash_password  # noqa: E402

# Fixed seed: the demo tells the same story every time it is run.
random.seed(20260917)

PASSWORD = "vesper123"  # demo only

ROOM_CATEGORIES = [
    ("deluxe", "Deluxe Room", 11500, 2, ["King bed", "City view", "Wi-Fi"]),
    ("executive", "Executive Room", 16800, 2, ["King bed", "Lounge access", "Wi-Fi"]),
    ("club", "Club Room", 23400, 3, ["Sea view", "Club lounge", "Breakfast"]),
    ("suite", "Suite", 38900, 4, ["Separate living room", "Sea view", "Butler"]),
]

# 355 rooms across 11 floors, weighted towards the cheaper categories as a real
# property is.
CATEGORY_MIX = ["deluxe"] * 180 + ["executive"] * 95 + ["club"] * 55 + ["suite"] * 25

DEPARTMENTS = [
    ("front_office", "Front Office", 20),
    ("housekeeping", "Housekeeping", 30),
    ("fnb", "Food & Beverage", 40),
    ("maintenance", "Maintenance", 60),
    ("store", "Store", 120),
    ("security", "Security", 30),
]

SHIFTS = [
    ("morning", "Morning", time(7, 0), time(15, 0)),
    ("evening", "Evening", time(15, 0), time(23, 0)),
    ("night", "Night", time(23, 0), time(7, 0)),
]

FIRST_NAMES = [
    "Aarav", "Diya", "Rohan", "Ananya", "Vikram", "Meera", "Arjun", "Kavya", "Rahul",
    "Sneha", "Karan", "Pooja", "Aditya", "Nisha", "Sanjay", "Priya", "Imran", "Fatima",
    "Joseph", "Grace", "Tenzin", "Lakshmi", "Farhan", "Ritu", "Manish", "Deepa",
]
LAST_NAMES = [
    "Sharma", "Patel", "Nair", "Reddy", "Iyer", "Singh", "Desai", "Mehta", "Gupta",
    "Khan", "Fernandes", "Joshi", "Chauhan", "Banerjee", "Rao", "Pillai", "Kulkarni",
]

MENU = [
    ("Breakfast", "Masala Omelette", 650, True, 20, "Three-egg omelette, green chilli, coriander"),
    ("Breakfast", "Poha", 450, True, 15, "Flattened rice, peanuts, curry leaves"),
    ("Breakfast", "Continental Platter", 1250, True, 25, "Pastries, fruit, yoghurt, juice"),
    ("All Day", "Club Sandwich", 850, False, 20, "Triple decker, chicken, fried egg"),
    ("All Day", "Paneer Tikka Roll", 720, True, 18, "Chargrilled paneer, mint chutney"),
    ("All Day", "Bombay Vada Pav", 380, True, 12, "Two pieces, dry garlic chutney"),
    ("Main", "Butter Chicken", 1450, False, 30, "Served with naan"),
    ("Main", "Dal Makhani", 890, True, 25, "Slow-cooked black lentils"),
    ("Main", "Goan Fish Curry", 1680, False, 30, "Kingfish, coconut, kokum"),
    ("Main", "Biryani (Veg)", 980, True, 35, "Hyderabadi style, raita"),
    ("Dessert", "Gulab Jamun", 420, True, 10, "Two pieces, warm"),
    ("Dessert", "Tiramisu", 580, True, 10, "Classic, mascarpone"),
    ("Beverages", "Masala Chai", 280, True, 8, "Pot for one"),
    ("Beverages", "Fresh Lime Soda", 320, True, 5, "Sweet, salted or mixed"),
    ("Beverages", "Cold Coffee", 420, True, 8, "With ice cream"),
]

STOCK = [
    # sku, name, category, unit, qty, minimum, reorder, cost, supplier, lead days
    ("FD-BREAD", "Sandwich Bread", "food", "loaf", 24, 20, 60, 55, "Mumbai Bakers", 1),
    ("FD-EGGS", "Eggs", "food", "tray", 30, 15, 50, 210, "Juhu Poultry", 1),
    ("FD-CHICKEN", "Chicken Breast", "food", "kg", 45, 25, 60, 320, "Coastal Meats", 2),
    ("FD-PANEER", "Paneer", "food", "kg", 18, 12, 30, 420, "Aarey Dairy", 1),
    ("FD-RICE", "Basmati Rice", "food", "kg", 180, 80, 200, 145, "Grain House", 3),
    ("FD-BUTTER", "Butter", "food", "kg", 22, 15, 40, 540, "Aarey Dairy", 2),
    ("FD-FISH", "Kingfish", "food", "kg", 16, 10, 25, 680, "Versova Fisheries", 1),
    ("BV-COFFEE", "Coffee Beans", "beverage", "kg", 14, 8, 25, 1250, "Coorg Roasters", 4),
    ("BV-TEA", "Tea Leaves", "beverage", "kg", 9, 6, 20, 890, "Assam Direct", 4),
    ("LN-TOWEL", "Bath Towels", "linen", "piece", 620, 400, 500, 340, "Linen Mills", 7),
    ("LN-SHEET", "Bed Sheets (King)", "linen", "set", 410, 300, 400, 780, "Linen Mills", 7),
    ("LN-ROBE", "Bathrobes", "linen", "piece", 180, 150, 200, 1150, "Linen Mills", 10),
    ("TL-SOAP", "Bath Soap", "toiletries", "piece", 900, 600, 1000, 45, "Amenity Co", 5),
    ("TL-SHAMPOO", "Shampoo 30ml", "toiletries", "piece", 850, 600, 1000, 38, "Amenity Co", 5),
    ("TL-DENTAL", "Dental Kit", "toiletries", "piece", 540, 500, 800, 32, "Amenity Co", 5),
    ("CL-FLOOR", "Floor Cleaner", "cleaning", "litre", 85, 50, 120, 190, "CleanPro", 3),
    ("SP-AC", "AC Filter", "spare_parts", "piece", 24, 20, 40, 850, "CoolTech", 6),
    ("SP-BULB", "LED Bulb 9W", "spare_parts", "piece", 210, 150, 300, 120, "Elektra", 4),
]

ASSETS = [
    ("CHL-01", "Chiller Unit 1", "chiller", "Plant Room, Basement", "critical", 2016),
    ("CHL-02", "Chiller Unit 2", "chiller", "Plant Room, Basement", "critical", 2018),
    ("LFT-01", "Guest Lift A", "lift", "Main Lobby", "critical", 2015),
    ("LFT-02", "Guest Lift B", "lift", "Main Lobby", "critical", 2015),
    ("LFT-03", "Service Lift", "lift", "Service Core", "high", 2015),
    ("BLR-01", "Hot Water Boiler", "boiler", "Plant Room, Basement", "high", 2017),
    ("GEN-01", "Diesel Generator", "generator", "Utility Yard", "critical", 2019),
    ("PMP-01", "Pool Circulation Pump", "pump", "Pool Deck", "medium", 2020),
    ("PMP-02", "Booster Pump", "pump", "Plant Room", "high", 2019),
    ("AHU-01", "Banquet AHU", "hvac", "Banquet Level", "high", 2018),
    ("KIT-01", "Walk-in Freezer", "kitchen", "Main Kitchen", "critical", 2019),
    ("KIT-02", "Combi Oven", "kitchen", "Main Kitchen", "high", 2021),
]

KNOWLEDGE = [
    ("Check-in and check-out times", "Check-in is from 2:00 PM and check-out is by 12:00 noon. Early check-in and late check-out are subject to availability; ask the front desk on extension 0.", "policy"),
    ("Swimming pool timings", "The rooftop pool is open from 6:00 AM to 9:00 PM daily. Children under 12 must be accompanied by an adult. Towels are available poolside at no charge.", "facilities"),
    ("Spa timings and booking", "The Quan Spa is open from 9:00 AM to 9:00 PM. Treatments should be booked at least two hours ahead on extension 4444. A 24-hour cancellation policy applies.", "facilities"),
    ("Gym access", "The fitness centre is open 24 hours for in-house guests. Access is with your room key card.", "facilities"),
    ("Breakfast", "Breakfast is served at the all-day dining restaurant from 7:00 AM to 10:30 AM on weekdays and until 11:00 AM at weekends. In-room breakfast is available from 6:30 AM.", "dining"),
    ("Room service hours", "In-room dining is available 24 hours. Orders placed between 11:00 PM and 6:00 AM are from the limited night menu.", "dining"),
    ("Restaurant timings", "The all-day restaurant serves lunch from 12:30 PM to 3:00 PM and dinner from 7:00 PM to 11:00 PM. The pool bar is open from 11:00 AM to 8:00 PM.", "dining"),
    ("Wi-Fi", "Wi-Fi is complimentary for all guests. Connect to the 'Vesper-Guest' network and sign in with your room number and surname.", "facilities"),
    ("Airport transfer", "The airport is about 20 minutes away. Airport transfers can be arranged through the concierge on extension 3333; please allow two hours' notice.", "services"),
    ("Laundry service", "Laundry collected before 9:00 AM is returned the same evening. Express service is available at a 50% surcharge. Bags are in your wardrobe.", "services"),
    ("Parking", "Valet parking is complimentary for in-house guests. Hand your keys to the porter at the main entrance.", "services"),
    ("Pets", "Guide dogs and service animals are welcome. Other pets cannot be accommodated.", "policy"),
    ("Smoking", "All rooms and indoor areas are non-smoking. Designated smoking areas are on the pool deck and in the utility yard.", "policy"),
    ("Doctor on call", "A doctor is on call 24 hours. Please dial 0 and the front desk will arrange a visit to your room.", "services"),
    ("Banquet and events", "Four banquet halls seat between 40 and 400 guests. The events team can be reached on extension 5555.", "facilities"),
]


def _demo_reference(index: int) -> str:
    """VS + a zero-padded base-36 counter. Short, readable and collision-free."""
    digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    value, out = index, ""
    while value:
        value, remainder = divmod(value, 36)
        out = digits[remainder] + out
    return "VS" + (out or "0").rjust(6, "0")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed the Vesper demo resort")
    parser.add_argument("--reset", action="store_true", help="Drop and recreate everything first")
    args = parser.parse_args()

    engine = get_engine()
    import_all_models(str(REPO_ROOT / "app" / "api"))

    if args.reset:
        with engine.begin() as connection:
            for schema in SCHEMAS:
                connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        print("dropped all schemas")

    with engine.begin() as connection:
        for schema in SCHEMAS:
            connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
    Base.metadata.create_all(engine)

    db = session_scope()
    try:
        counts = _seed(db)
    finally:
        db.close()

    print("\nDemo resort ready:")
    for label, count in counts.items():
        print(f"  {label:<22} {count}")
    print(f"\nSign in with any email below and the password: {PASSWORD}")
    print("  owner@vesper.demo      owner   — sees everything")
    print("  gm@vesper.demo         gm      — approves rates and offers")
    print("  fom@vesper.demo        manager — front office")
    print("  exec@vesper.demo       manager — housekeeping")
    print("  chef@vesper.demo       manager — food & beverage")
    print("  hk1@vesper.demo        employee— a housekeeper")
    return 0


def _seed(db) -> dict[str, int]:
    # Imported here so a missing models module fails loudly at seed time, not import.
    # These names come from import_all_models above, which loads each app/api/<name>/
    # models.py by path — so they track the directory names, not the old service ones.
    import vesper_models.property as prop
    import vesper_models.identity as ident
    import vesper_models.staff as staff
    import vesper_models.guest as guest
    import vesper_models.inventory as inv
    import vesper_models.frontdesk as fd
    import vesper_models.revenue as rev
    import vesper_models.guest_intel as gi

    counts: dict[str, int] = {}
    today = utcnow().astimezone(property_tz()).date()

    # --- property, departments, categories, rooms ---------------------------------
    property_row = prop.Property(
        name="JW Marriott Mumbai, Juhu",
        address="Juhu Tara Road, Mumbai, Maharashtra 400049",
        city="Mumbai",
        timezone="Asia/Kolkata",
        currency="INR",
        total_rooms=len(CATEGORY_MIX),
        check_in_hour=14,
        check_out_hour=12,
        settings={"shadow_mode": False},
    )
    db.add(property_row)
    db.flush()
    pid = property_row.id

    departments = {}
    for key, name, sla in DEPARTMENTS:
        row = prop.Department(property_id=pid, key=key, name=name, default_sla_minutes=sla)
        db.add(row)
        departments[key] = row
    db.flush()

    categories = {}
    for key, name, rate, occupancy, amenities in ROOM_CATEGORIES:
        row = prop.RoomCategory(
            property_id=pid,
            key=key,
            name=name,
            base_rate=Decimal(rate),
            max_occupancy=occupancy,
            amenities=amenities,
        )
        db.add(row)
        categories[key] = row
    db.flush()

    rooms: list = []
    mix = list(CATEGORY_MIX)
    random.shuffle(mix)
    index = 0
    for floor in range(2, 13):  # floors 2-12
        for number in range(1, 34):
            if index >= len(mix):
                break
            room = prop.Room(
                property_id=pid,
                category_id=categories[mix[index]].id,
                number=f"{floor}{number:02d}",
                floor=floor,
                status=prop.RoomStatus.READY,
                qr_secret=secrets.token_urlsafe(24),
            )
            db.add(room)
            rooms.append(room)
            index += 1
    db.flush()
    counts["rooms"] = len(rooms)
    counts["departments"] = len(departments)

    # --- roles and users ----------------------------------------------------------
    from vesper_common.permissions import DEFAULT_ROLE_PERMISSIONS

    roles = {}
    for key, perms in DEFAULT_ROLE_PERMISSIONS.items():
        row = ident.Role(
            property_id=pid,
            key=str(key),
            label="GM" if key == "gm" else str(key).title(),
            permissions=sorted(str(p) for p in perms),
            is_system=True,
        )
        db.add(row)
        roles[str(key)] = row
    db.flush()

    hashed = hash_password(PASSWORD)
    users: list = []

    def add_user(email: str, name: str, role: str, department: str | None, code: str):
        row = ident.User(
            property_id=pid,
            department_id=departments[department].id if department else None,
            role_id=roles[role].id,
            email=email,
            full_name=name,
            phone=f"+9198{random.randint(10000000, 99999999)}",
            employee_code=code,
            password_hash=hashed,
        )
        db.add(row)
        users.append(row)
        return row

    add_user("owner@vesper.demo", "Rustom Mistry", "owner", None, "EMP0001")
    add_user("gm@vesper.demo", "Anjali Verma", "gm", None, "EMP0002")
    add_user("fom@vesper.demo", "Nikhil Rao", "manager", "front_office", "EMP0003")
    add_user("exec@vesper.demo", "Sunita Pillai", "manager", "housekeeping", "EMP0004")
    add_user("chef@vesper.demo", "Marco Dias", "manager", "fnb", "EMP0005")
    add_user("chiefeng@vesper.demo", "Prakash Menon", "manager", "maintenance", "EMP0006")
    add_user("store@vesper.demo", "Hemant Shah", "manager", "store", "EMP0007")
    add_user("security@vesper.demo", "Balbir Singh", "manager", "security", "EMP0008")
    add_user("hk1@vesper.demo", "Laxmi Gaikwad", "employee", "housekeeping", "EMP0009")

    # ~180 staff across six departments, weighted the way a resort really is.
    headcount = {"housekeeping": 62, "fnb": 54, "front_office": 24, "maintenance": 18, "store": 8, "security": 14}
    counter = 10
    for department, total in headcount.items():
        for i in range(total):
            name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
            role = "supervisor" if i < max(1, total // 12) else "employee"
            add_user(
                f"{department}{i + 1}@vesper.demo", name, role, department, f"EMP{counter:04d}"
            )
            counter += 1
    db.flush()
    counts["users"] = len(users)

    # --- shifts -------------------------------------------------------------------
    for key, name, starts, ends in SHIFTS:
        db.add(
            staff.Shift(
                property_id=pid, key=key, name=name, starts_at=starts, ends_at=ends, grace_minutes=15
            )
        )
    db.flush()

    # --- menu and its recipes -----------------------------------------------------
    stock_items = {}
    for sku, name, category, unit, qty, minimum, reorder, cost, supplier, lead in STOCK:
        row = inv.StockItem(
            property_id=pid,
            department_id=departments["store"].id,
            sku=sku,
            name=name,
            category=category,
            unit=unit,
            quantity=Decimal(qty),
            minimum_quantity=Decimal(minimum),
            reorder_quantity=Decimal(reorder),
            unit_cost=Decimal(cost),
            supplier=supplier,
            lead_time_days=lead,
            expires_on=today + timedelta(days=random.randint(3, 90))
            if category in {"food", "beverage"}
            else None,
        )
        db.add(row)
        stock_items[sku] = row
    db.flush()
    counts["stock_items"] = len(stock_items)

    # Recipes tie the menu to the store, which is what makes stock auto-deduct.
    # Every menu item consumes something. An item with no recipe silently deducts
    # nothing, which quietly breaks the point of auto-deduction, so the list below
    # covers the whole menu rather than a sample of it.
    recipes = {
        "Masala Omelette": {"FD-EGGS": 0.1, "FD-BREAD": 0.1},
        "Poha": {"FD-RICE": 0.12},
        "Continental Platter": {"FD-BREAD": 0.2, "FD-BUTTER": 0.02},
        "Club Sandwich": {"FD-BREAD": 0.25, "FD-CHICKEN": 0.15, "FD-EGGS": 0.05},
        "Paneer Tikka Roll": {"FD-PANEER": 0.18, "FD-BREAD": 0.15},
        "Bombay Vada Pav": {"FD-BREAD": 0.2},
        "Butter Chicken": {"FD-CHICKEN": 0.3, "FD-BUTTER": 0.05},
        "Dal Makhani": {"FD-BUTTER": 0.04},
        "Goan Fish Curry": {"FD-FISH": 0.28},
        "Biryani (Veg)": {"FD-RICE": 0.25, "FD-PANEER": 0.08},
        "Gulab Jamun": {"FD-BUTTER": 0.02},
        "Tiramisu": {"BV-COFFEE": 0.01, "FD-BUTTER": 0.03},
        "Masala Chai": {"BV-TEA": 0.01},
        "Fresh Lime Soda": {},  # nothing tracked in the store
        "Cold Coffee": {"BV-COFFEE": 0.02},
    }
    missing = [name for _, name, *_ in MENU if name not in recipes]
    if missing:
        raise SystemExit(f"menu items without a recipe entry: {missing}")

    menu_count = 0
    for category, name, price, is_veg, prep, description in MENU:
        recipe = {
            str(stock_items[sku].id): amount
            for sku, amount in recipes.get(name, {}).items()
            if sku in stock_items
        }
        db.add(
            guest.MenuItem(
                property_id=pid,
                category=category,
                name=name,
                description=description,
                price=Decimal(price),
                is_veg=is_veg,
                prep_minutes=prep,
                recipe=recipe,
            )
        )
        menu_count += 1
    db.flush()
    counts["menu_items"] = menu_count

    # --- assets and a fortnight of sensor history ---------------------------------
    assets = []
    for code, name, asset_type, location, criticality, installed_year in ASSETS:
        row = prop.Asset(
            property_id=pid,
            department_id=departments["maintenance"].id,
            code=code,
            name=name,
            asset_type=asset_type,
            location=location,
            criticality=criticality,
            installed_on=date(installed_year, random.randint(1, 12), random.randint(1, 28)),
            last_serviced_on=today - timedelta(days=random.randint(30, 260)),
            service_interval_days=180,
        )
        db.add(row)
        assets.append(row)
    db.flush()
    counts["assets"] = len(assets)

    # Chiller 1 is the demo's failing machine: its vibration trends upward over the
    # fortnight and spikes near the end, so the anomaly detector has something true to
    # find rather than noise to guess at.
    metrics = {
        "chiller": ("vibration_mm_s", 2.4, 0.18),
        "lift": ("motor_temp_c", 48.0, 2.0),
        "boiler": ("pressure_bar", 3.2, 0.12),
        "generator": ("fuel_level_pct", 82.0, 3.0),
        "pump": ("flow_lpm", 320.0, 12.0),
        "hvac": ("return_temp_c", 24.5, 0.9),
        "kitchen": ("temp_c", -18.5, 0.7),
    }
    readings = 0
    now = utcnow()
    for asset in assets:
        metric, baseline, spread = metrics.get(asset.asset_type, ("value", 50.0, 2.0))
        failing = asset.code == "CHL-01"
        for hours_ago in range(24 * 14, 0, -2):  # one sample every two hours
            drift = 0.0
            if failing:
                progress = 1 - hours_ago / (24 * 14)
                drift = progress * baseline * 0.55
                if progress > 0.9 and random.random() < 0.25:
                    drift += baseline * 0.5  # intermittent spikes as it gets worse
            db.add(
                prop.SensorReading(
                    asset_id=asset.id,
                    metric=metric,
                    value=round(random.gauss(baseline + drift, spread), 4),
                    unit=metric.split("_")[-1],
                    recorded_at=now - timedelta(hours=hours_ago),
                )
            )
            readings += 1
    db.flush()
    counts["sensor_readings"] = readings

    # --- guests, bookings, stays --------------------------------------------------
    # A realistic guest population, not a small pool sharing every booking between them.
    #
    # The first version created 140 guests and picked randomly, which gave every single
    # one around 270 stays. That is not a hotel, and it quietly broke three features that
    # read visit history: every guest looked loyal, every churn rhythm looked tight, and
    # the "has this person actually been a good customer" check that gates a reward
    # passed for everybody.
    #
    # Real hotels are a long tail: most people come once, some come back, a small core
    # are regulars. Guests are created as bookings need them, with a minority drawn from
    # a returning pool.
    LOYAL_CORE = 300
    # Chance a booking belongs to someone who has stayed before.
    RETURN_RATE = 0.35
    # Of those, how often it is one of the regulars rather than a second-time visitor.
    LOYAL_SHARE = 0.55

    guests: list = []
    loyal: list = []
    guest_counter = 0

    def new_guest(*, regular: bool = False):
        nonlocal guest_counter
        guest_counter += 1
        row = guest.Guest(
            # Assigned here rather than at flush time: the booking created in the same
            # breath needs this id immediately, and flushing once per guest to get it
            # would mean twenty thousand round trips.
            id=uuid4(),
            property_id=pid,
            full_name=f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
            email=f"guest{guest_counter}@example.com",
            phone=f"+9199{random.randint(10000000, 99999999)}",
            city=random.choice(["Mumbai", "Delhi", "Bengaluru", "Pune", "Dubai", "London"]),
            loyalty_tier=(
                random.choice(["silver", "gold", "platinum"])
                if regular
                else random.choice(["none"] * 6 + ["silver", "gold"])
            ),
            is_vip=regular and random.random() < 0.25,
        )
        db.add(row)
        guests.append(row)
        if regular:
            loyal.append(row)
        return row

    for _ in range(LOYAL_CORE):
        new_guest(regular=True)
    db.flush()

    def pick_guest():
        """A returning guest, or a brand-new one."""
        if guests and random.random() < RETURN_RATE:
            if loyal and random.random() < LOYAL_SHARE:
                return random.choice(loyal)
            return random.choice(guests[-4000:])  # somebody recent, coming back
        return new_guest()

    # A year of bookings so the demand engine has real seasonality to fit, not a
    # straight line. Weekends and the Nov-Feb season run fuller, as Mumbai really does.
    season = {1: 1.10, 2: 1.08, 3: 1.00, 4: 0.95, 5: 0.92, 6: 0.80,
              7: 0.78, 8: 0.82, 9: 0.90, 10: 1.05, 11: 1.12, 12: 1.20}
    bookings = 0
    visits = 0
    category_list = list(categories.values())
    # A year of bookings is ~35k rows. Six random hex characters collide long before
    # that by the birthday paradox, so references are drawn from a counter here and
    # uniqueness is a property of the seed rather than a gamble.
    reference_seq = itertools.count(1)
    for days_ago in range(365, -14, -1):
        day = today - timedelta(days=days_ago)
        occupancy = min(0.97, max(0.25, random.gauss(0.68, 0.09) * season[day.month] * (1.12 if day.weekday() >= 4 else 1.0)))
        arrivals = int(len(rooms) * occupancy / 2.4)  # average stay ~2.4 nights
        for _ in range(arrivals):
            guest_row = pick_guest()
            category = random.choices(category_list, weights=[180, 95, 55, 25])[0]
            nights = random.choices([1, 2, 3, 4, 7], weights=[30, 35, 20, 10, 5])[0]
            rate = Decimal(int(float(category.base_rate) * random.uniform(0.85, 1.25) / 100) * 100)
            booking = fd.Booking(
                property_id=pid,
                guest_id=guest_row.id,
                room_category_id=category.id,
                reference=_demo_reference(next(reference_seq)),
                check_in_date=day,
                check_out_date=day + timedelta(days=nights),
                adults=random.randint(1, 2),
                rate=rate,
                total_amount=rate * nights,
                source=random.choice(["direct", "direct", "ota", "corporate", "travel_agent"]),
                status=fd.BookingStatus.CHECKED_OUT if days_ago > 0 else fd.BookingStatus.CONFIRMED,
            )
            db.add(booking)
            bookings += 1

            # Past stays become visits, which is what Guest DNA and churn risk read.
            if days_ago > 0:
                db.add(
                    fd.GuestVisit(
                        property_id=pid,
                        guest_id=guest_row.id,
                        kind=fd.VisitKind.STAY,
                        occurred_on=day,
                        amount=rate * nights,
                    )
                )
                visits += 1
        if days_ago % 30 == 0:
            db.flush()
    db.flush()
    counts["guests"] = len(guests)
    counts["bookings"] = bookings
    counts["guest_visits"] = visits

    # --- today: some rooms occupied so the QR demo works out of the box -----------
    in_house = 0
    arriving = [b for b in db.query(fd.Booking).filter(fd.Booking.check_in_date == today).limit(90)]
    available = [r for r in rooms]
    random.shuffle(available)
    for booking in arriving[:80]:
        room = available.pop()
        booking.status = fd.BookingStatus.CHECKED_IN
        booking.room_id = room.id
        room.status = prop.RoomStatus.OCCUPIED
        room.status_changed_at = utcnow()
        db.add(
            fd.Stay(
                property_id=pid,
                booking_id=booking.id,
                guest_id=booking.guest_id,
                room_id=room.id,
                room_number=room.number,
                checked_in_at=utcnow() - timedelta(hours=random.randint(1, 20)),
                folio_total=booking.total_amount,
            )
        )
        in_house += 1
    # A handful of dirty rooms so the housekeeping board has work on it.
    for room in available[:22]:
        room.status = prop.RoomStatus.DIRTY
        room.status_changed_at = utcnow()
    db.flush()
    counts["stays_in_house"] = in_house

    # --- competitors --------------------------------------------------------------
    competitors = [
        ("Sea Breeze Resort, Juhu", 0.6, 5),
        ("Novotel Juhu Beach", 1.1, 5),
        ("Sun-n-Sand Hotel", 0.9, 4),
        ("Ramada Plaza Palm Grove", 1.4, 4),
    ]
    comp_rates = 0
    for name, distance, stars in competitors:
        row = rev.Competitor(property_id=pid, name=name, distance_km=distance, star_rating=stars)
        db.add(row)
        db.flush()
        for offset in range(0, 30):
            day = today + timedelta(days=offset)
            base = 12000 + stars * 1400
            weekend = 1.15 if day.weekday() >= 4 else 1.0
            db.add(
                rev.CompetitorRate(
                    property_id=pid,
                    competitor_id=row.id,
                    stay_date=day,
                    rate=Decimal(int(base * weekend * random.uniform(0.92, 1.12) / 100) * 100),
                )
            )
            comp_rates += 1
    counts["competitor_rates"] = comp_rates

    # --- concierge knowledge base -------------------------------------------------
    for title, content, category in KNOWLEDGE:
        db.add(
            gi.KnowledgePassage(
                property_id=pid, title=title, content=content, category=category
            )
        )
    counts["knowledge_passages"] = len(KNOWLEDGE)

    db.commit()
    return counts


if __name__ == "__main__":
    raise SystemExit(main())
