"""Seed the demo resort.

Builds JW Marriott Mumbai, Juhu as a simulated property: rooms, staff, menu, stock,
assets with a year of sensor history, and enough booking history for the demand engine
to have something real to fit.

Everything here is fabricated. No real guest, booking, employee or revenue figure
appears in this repository.

Run: python scripts/seed.py [--reset --confirm-reset]
An ordinary rerun adds any missing connected workflow examples to the existing demo.
To add future reservations to an existing property, use scripts/seed_reservations.py.

The seed never appends a second copy of this resort. --reset remains an explicit
destructive demo-only operation.
"""
from __future__ import annotations

import argparse
import itertools
import random
import secrets
import sys
from uuid import uuid4
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py-common"))
sys.path.insert(0, str(REPO_ROOT))

from sqlalchemy import inspect, select, text  # noqa: E402

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

ROOM_CATEGORY_IMAGES = {
    "deluxe": [
        ("https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-premium-room-2715-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*", "JW Marriott Deluxe Premium King Room", True),
        ("https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-twin-deluxe-5333-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*", "JW Marriott Deluxe Twin Room", False),
        ("https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-guestroom-8493-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*", "Deluxe Guest Room Interior", False),
    ],
    "executive": [
        ("https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-twin-executive-lounge-21464:Classic-Hor?wid=1336&fit=constrain", "Executive Lounge & Twin Room", True),
        ("https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-executive-8497-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*", "Executive Room Suite", False),
    ],
    "club": [
        ("https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-club-8499-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*", "JW Marriott Club Ocean Room", True),
        ("https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-ocean-8495-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*", "Panoramic Arabian Sea Ocean View", False),
    ],
    "suite": [
        ("https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-grand-ocean-6995-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*", "Grand Ocean Luxury Suite", True),
        ("https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-living-room-33278:Wide-Hor?wid=750&fit=constrain", "Suite Private Living Room", False),
        ("https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-royal-8503-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*", "Royal Suite Master Bedroom", False),
        ("https://cache.marriott.com/is/image/marriotts7prod/jw-bomjw-king-28398:Wide-Hor?wid=750&fit=constrain", "King Bed Suite", False),
        ("https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-presidential-8501-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*", "Presidential Suite Lounge", False),
        ("https://cache.marriott.com/content/dam/marriott-renditions/BOMJW/bomjw-bath-6719-hor-wide.jpg?output-quality=70&interpolation=progressive-bilinear&downsize=750px:*", "Marble En-suite Luxury Bathroom", False),
    ],
}

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
    ("FD-LIME", "Fresh Limes", "food", "kg", 18, 8, 25, 95, "Juhu Produce", 2),
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

RESORT_AMENITIES = [
    # key, name, description, location, opening hours
    ("rooftop_pool", "Rooftop pool", "Pool towels are provided; children under 12 need an adult.", "Rooftop", "Daily, 6:00 AM–9:00 PM"),
    ("quan_spa", "Quan Spa", "Treatments require advance booking on extension 4444.", "Spa level", "Daily, 9:00 AM–9:00 PM"),
    ("fitness_centre", "Fitness centre", "In-house guests can enter with a room key card.", "Fitness centre", "24 hours"),
    ("all_day_dining", "All-day dining", "Breakfast, lunch and dinner are served here.", "Restaurant level", "Breakfast 7:00–10:30 AM weekdays, until 11:00 AM weekends; lunch 12:30–3:00 PM; dinner 7:00–11:00 PM"),
    ("pool_bar", "Pool bar", "Drinks and light refreshments by the pool.", "Pool deck", "Daily, 11:00 AM–8:00 PM"),
    ("valet_parking", "Valet parking", "Complimentary valet parking for in-house guests.", "Main entrance", "24 hours"),
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
    parser.add_argument("--reset", action="store_true", help="DANGEROUS: drop and recreate all Vesper schemas")
    parser.add_argument("--confirm-reset", action="store_true",
                        help="Confirm the destructive --reset operation on a disposable database")
    args = parser.parse_args()
    if args.reset != args.confirm_reset:
        parser.error("--reset drops every Vesper schema; use --reset --confirm-reset "
                     "only on a disposable database")

    engine = get_engine()
    import_all_models(str(REPO_ROOT / "app" / "api"))

    # An existing demo gets only the idempotent workflow pack; never duplicate its
    # rooms, people, bookings or food order history.
    if not args.reset and inspect(engine).has_table("properties", schema="property"):
        import vesper_models.property as prop
        with session_scope() as existing:
            existing_id = existing.scalar(select(prop.Property.id).where(
                prop.Property.name == "JW Marriott Mumbai, Juhu"
            ).limit(1))
        if existing_id is not None:
            from scripts.seed_existing import enrich_existing_demo
            from scripts.seed_staff_tasks import seed_claimable_work, seed_staff_tasks
            from scripts.seed_workflow import seed_workflow
            import vesper_models.guest as guest
            with session_scope() as db:
                has_food_orders = db.scalar(select(guest.ServiceRequest.id).where(
                    guest.ServiceRequest.property_id == existing_id,
                    guest.ServiceRequest.kind == guest.RequestKind.ROOM_SERVICE,
                ).limit(1)) is not None
                if not has_food_orders:
                    from scripts.seed_fnb import seed_fnb_data
                    food_counts = seed_fnb_data(db, property_id=existing_id)
                    print(f"Recovered missing food-order seed: {food_counts['fnb_orders_total']} orders")
                enrichment = enrich_existing_demo(db, existing_id)
                assignments = seed_staff_tasks(db, existing_id)
                claimable = seed_claimable_work(db, existing_id)
                result = seed_workflow(db, existing_id, apply=True)
            print(f"Demo resort already exists. Added {result['created']} workflow rows; "
                  f"{result['already_present']} already present.")
            for label, count in enrichment.items():
                print(f"  {label:<22} {count}")
            for label, count in assignments.items():
                print(f"  {label:<22} {count}")
            for label, count in claimable.items():
                print(f"  pool_{label:<17} {count}")
            print("No base data was reset.")
            return 0

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
    print("  owner@vesper.demo      owner   — Property Owner / Executive Director")
    print("  gm@vesper.demo         gm      — General Manager")
    print("  fom@vesper.demo        manager — front office")
    print("  exec@vesper.demo       manager — housekeeping")
    print("  chef@vesper.demo       manager — food & beverage")
    print("  hk1@vesper.demo        staff   — a housekeeper")
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

    # --- monthly departmental budgets for the owner and procurement dashboards ---
    # These are explicitly synthetic demo allocations, aligned to the active month.
    period_start = today.replace(day=1)
    next_month = (period_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    period_end = next_month - timedelta(days=1)
    budget_allocations = {
        "front_office": Decimal("1800000"),
        "housekeeping": Decimal("2400000"),
        "fnb": Decimal("5200000"),
        "maintenance": Decimal("3100000"),
        "store": Decimal("1600000"),
    }
    for department_key, allocation in budget_allocations.items():
        db.add(inv.DepartmentBudget(
            property_id=pid,
            department_id=departments[department_key].id,
            period_start=period_start,
            period_end=period_end,
            currency="INR",
            allocated=allocation,
        ))
    counts["department_budgets"] = len(budget_allocations)

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

    for cat_key, img_list in ROOM_CATEGORY_IMAGES.items():
        if cat_key in categories:
            cat_row = categories[cat_key]
            for pos, (url, alt, is_primary) in enumerate(img_list):
                db.add(prop.RoomImage(
                    property_id=pid,
                    category_id=cat_row.id,
                    url=url,
                    alt_text=alt,
                    position=pos,
                    is_primary=is_primary,
                ))
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

    for key, name, description, location, hours in RESORT_AMENITIES:
        db.add(prop.ResortAmenity(
            property_id=pid, key=key, name=name, description=description,
            location=location, opening_hours=hours, is_available=True,
        ))
    counts["resort_amenities"] = len(RESORT_AMENITIES)

    # --- roles and users ----------------------------------------------------------
    from vesper_common.permissions import DEFAULT_ROLE_PERMISSIONS

    roles = {}
    for key, perms in DEFAULT_ROLE_PERMISSIONS.items():
        label_text = "Property Owner" if key == "owner" else ("General Manager" if key == "gm" else str(key).title())
        row = ident.Role(
            property_id=pid,
            key=str(key),
            label=label_text,
            permissions=sorted(str(p) for p in perms),
            is_system=True,
        )
        db.add(row)
        roles[str(key)] = row
    db.flush()

    hashed = hash_password(PASSWORD)
    users: list = []

    def add_user(email: str, name: str, role: str, department: str | None, code: str):
        staff_grants = {"issues:write", "guest_review:write"}
        if department == "housekeeping":
            staff_grants |= {"rooms:status_write", "requests:read", "requests:accept"}
        if department in {"fnb", "front_office"}:
            staff_grants |= {"requests:read", "requests:accept"}
        if department == "front_office":
            staff_grants |= {"bookings:read", "bookings:write", "guests:read"}
        if department in {"housekeeping", "maintenance", "fnb", "front_office", "store", "security"}:
            staff_grants.add("tasks:pool_read")
        if department == "store":
            staff_grants |= {"stock:read"}
        row = ident.User(
            property_id=pid,
            department_id=departments[department].id if department else None,
            role_id=roles[role].id,
            email=email,
            full_name=name,
            phone=f"+9198{random.randint(10000000, 99999999)}",
            employee_code=code,
            password_hash=hashed,
            extra_permissions=sorted(staff_grants) if role == "staff" else [],
        )
        db.add(row)
        users.append(row)
        db.add(ident.UserAssignment(user=row, property_id=pid, department_id=departments[department].id if department and role not in {"gm", "owner"} else None))
        return row

    add_user("owner@vesper.demo", "Rustom Mistry", "owner", None, "EMP0001")
    add_user("gm@vesper.demo", "Anjali Verma", "gm", None, "EMP0002")
    front_manager = add_user("fom@vesper.demo", "Nikhil Rao", "manager", "front_office", "EMP0003")
    housekeeping_manager = add_user("exec@vesper.demo", "Sunita Pillai", "manager", "housekeeping", "EMP0004")
    fnb_manager = add_user("chef@vesper.demo", "Marco Dias", "manager", "fnb", "EMP0005")
    add_user("chiefeng@vesper.demo", "Prakash Menon", "staff", "maintenance", "EMP0006")
    add_user("store@vesper.demo", "Hemant Shah", "staff", "store", "EMP0007")
    add_user("security@vesper.demo", "Balbir Singh", "staff", "security", "EMP0008")
    add_user("hk1@vesper.demo", "Laxmi Gaikwad", "staff", "housekeeping", "EMP0009")
    db.flush()
    departments["front_office"].head_user_id = front_manager.id
    departments["housekeeping"].head_user_id = housekeeping_manager.id
    departments["fnb"].head_user_id = fnb_manager.id
    departments["maintenance"].head_user_id = housekeeping_manager.id
    db.add(ident.UserAssignment(
        user=housekeeping_manager, property_id=pid,
        department_id=departments["maintenance"].id,
    ))

    # ~180 staff across six departments, weighted the way a resort really is.
    headcount = {"housekeeping": 62, "fnb": 54, "front_office": 24, "maintenance": 18, "store": 8, "security": 14}
    counter = 10
    for department, total in headcount.items():
        for i in range(total):
            name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
            role = "staff"
            add_user(
                f"{department}{i + 1}@vesper.demo", name, role, department, f"EMP{counter:04d}"
            )
            counter += 1
    db.flush()
    counts["users"] = len(users)

    # --- shifts -------------------------------------------------------------------
    shifts = {}
    for key, name, starts, ends in SHIFTS:
        shift = staff.Shift(
            property_id=pid, key=key, name=name, starts_at=starts, ends_at=ends,
            grace_minutes=15,
        )
        db.add(shift)
        shifts[key] = shift
    db.flush()

    # Every demo staff account has recent attendance for its own dashboard. The
    # performance API computes metrics from these records; no score is seeded.
    attendance_count = 0
    now = utcnow()
    local_tz = property_tz()
    for department in departments.values():
        members = [u for u in users if u.role_id == roles["staff"].id
                   and u.department_id == department.id]
        for member in members:
            for days_ago in range(5, -1, -1):
                work_day = today - timedelta(days=days_ago)
                local_start = datetime.combine(work_day, time(7, 0), tzinfo=local_tz)
                minutes_after_start = random.randint(2, 35)
                checked_in = (local_start + timedelta(minutes=minutes_after_start)).astimezone(timezone.utc)
                if checked_in > now:
                    continue
                completed_at = checked_in + timedelta(hours=8)
                checked_out = completed_at if completed_at <= now else None
                db.add(staff.Attendance(
                    property_id=pid, user_id=member.id, department_id=department.id,
                    shift_id=shifts["morning"].id,
                    work_date=datetime.combine(work_day, time.min),
                    checked_in_at=checked_in, checked_out_at=checked_out,
                    method=staff.AttendanceMethod.MANUAL,
                    is_late=minutes_after_start > shifts["morning"].grace_minutes,
                    late_by_minutes=max(0, minutes_after_start - shifts["morning"].grace_minutes),
                    worked_minutes=480 if checked_out else 0,
                ))
                attendance_count += 1
    counts["attendance_records"] = attendance_count

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
        "Fresh Lime Soda": {"FD-LIME": 0.08},
        "Cold Coffee": {"BV-COFFEE": 0.02},
    }
    missing = [name for _, name, *_ in MENU if not recipes.get(name)]
    if missing:
        raise SystemExit(f"menu items without a stocked recipe: {missing}")
    unknown_stock = {sku for recipe in recipes.values() for sku in recipe} - stock_items.keys()
    if unknown_stock:
        raise SystemExit(f"menu recipes reference missing stock: {sorted(unknown_stock)}")

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
    available_by_category = {category.id: [] for category in categories.values()}
    for room in rooms:
        available_by_category[room.category_id].append(room)
    for category_rooms in available_by_category.values():
        random.shuffle(category_rooms)
    for booking in arriving[:80]:
        matching_rooms = available_by_category[booking.room_category_id]
        if not matching_rooms:
            raise RuntimeError("Not enough rooms in a booked category to seed in-house stays")
        room = matching_rooms.pop()
        booking.status = fd.BookingStatus.CHECKED_IN
        booking.room_id = room.id
        # An active stay is the occupancy record. Housekeeping state is independent.
        room.status = prop.RoomStatus.DIRTY if in_house < 6 else prop.RoomStatus.READY
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
    available = [room for category_rooms in available_by_category.values() for room in category_rooms]
    for room in available[:22]:
        room.status = prop.RoomStatus.DIRTY
        room.status_changed_at = utcnow()
    db.flush()
    counts["stays_in_house"] = in_house
    counts["occupied_needing_cleaning"] = min(in_house, 6)

    dirty_rooms = [room for room in rooms if room.status == prop.RoomStatus.DIRTY]
    housekeepers = [u for u in users if u.role_id == roles["staff"].id
                    and u.department_id == departments["housekeeping"].id]
    for index, room in enumerate(dirty_rooms[:12]):
        db.add(staff.Task(
            property_id=pid, department_id=departments["housekeeping"].id,
            assignee_id=housekeepers[index % len(housekeepers)].id, room_id=room.id,
            title=f"Clean room {room.number}",
            description="Housekeeping service requested for this room.",
            status=staff.TaskStatus.ASSIGNED,
            priority=staff.TaskPriority.NORMAL,
            source=staff.TaskSource.MANUAL,
            due_at=utcnow() + timedelta(hours=2),
        ))
    counts["housekeeping_tasks"] = min(len(dirty_rooms), 12)

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

    # --- rate history (revenue changes visible to owner) -------------------------
    # Seed 30 days of rate history so the Revenue Insights page is not empty.
    rate_history_count = 0
    owner_user = users[0]  # owner is first user
    gm_user = users[1]     # gm is second user
    for cat_key, cat_row in categories.items():
        base = float(cat_row.base_rate)
        for days_ago in range(30, 0, -1):
            day = today - timedelta(days=days_ago)
            prev_rate = Decimal(int(base * random.uniform(0.85, 1.05) / 100) * 100)
            new_rate = Decimal(int(base * random.uniform(0.90, 1.30) / 100) * 100)
            # Only log meaningful changes (more than 5% swing)
            if abs(float(new_rate) - float(prev_rate)) / max(float(prev_rate), 1) < 0.05:
                continue
            source = random.choices(
                [rev.RateSource.ACTION_CARD, rev.RateSource.MANUAL, rev.RateSource.BASE],
                weights=[55, 30, 15],
            )[0]
            db.add(rev.RateHistory(
                property_id=pid,
                room_category_id=cat_row.id,
                stay_date=day,
                previous_rate=prev_rate,
                new_rate=new_rate,
                source=source,
                changed_by=gm_user.id if source == rev.RateSource.MANUAL else None,
            ))
            rate_history_count += 1
    db.flush()
    counts["rate_history_entries"] = rate_history_count

    # --- owner-level AI action cards (populates the Action Queue) ----------------
    import vesper_models.action as act

    owner_action_cards = [
        # High-impact rate surge for Diwali peak
        dict(
            engine="revenue.demand",
            kind=act.CardKind.RATE_CHANGE,
            status=act.CardStatus.PENDING,
            title="Diwali Peak: Raise Suite ADR by +18%",
            summary=(
                "Suite occupancy pace for Oct 20–Nov 5 is tracking at 94% — 12 points above "
                "the seasonal baseline. Competitor comp-set rates are ₹6,200 lower on average. "
                "AI recommends raising Suite ADR from ₹38,900 to ₹45,900 to capture peak demand "
                "premium. Projected incremental yield: ₹4.8L across 15 nights."
            ),
            drivers=[
                {"label": "94% Occupancy Pace", "detail": "15 days ahead of arrival — highest advance booking in 14 months", "weight": 0.45},
                {"label": "Comp-Set Under-pricing", "detail": "Sea Breeze & Novotel averaging ₹6,200 below our current suite rate", "weight": 0.30},
                {"label": "Diwali Event Premium", "detail": "Historical Diwali ADR uplift: +22% vs standard weekend in this property", "weight": 0.25},
            ],
            confidence=0.91,
            impact_amount=Decimal("480000"),
            urgency=act.Urgency.HIGH,
            score=0.82,
            required_permission="cards:approve",
            payload={"category": "suite", "new_rate": 45900, "current_rate": 38900, "nights": 15, "editable_fields": ["new_rate"]},
            undo_payload={"category": "suite", "restore_rate": 38900},
        ),
        # Solar PPA — CapEx decision
        dict(
            engine="asset.sustainability",
            kind=act.CardKind.WORK_ORDER,
            status=act.CardStatus.PENDING,
            title="Approve 120 kW Rooftop Solar PPA Contract",
            summary=(
                "DISCOM tariff has increased 14.6% YoY. A 120 kW rooftop solar PPA with "
                "SunEdge Energy cuts monthly DISCOM draw by 24%, saving ₹4.2L per month. "
                "Zero upfront capital — performance-based PPA model over 15 years. "
                "Payback vs baseline: 18 months. IRR: 22.4%."
            ),
            drivers=[
                {"label": "+14.6% Electricity Tariff Rise", "detail": "DISCOM unit rate increased from ₹9.20 to ₹10.55/kWh in FY26", "weight": 0.40},
                {"label": "₹4.2L/mo Projected Savings", "detail": "Based on 120 kW generation at 5.2 peak sun hours/day", "weight": 0.40},
                {"label": "Zero CapEx PPA Structure", "detail": "SunEdge Energy performance contract — no upfront investment required", "weight": 0.20},
            ],
            confidence=0.88,
            impact_amount=Decimal("420000"),
            urgency=act.Urgency.MEDIUM,
            score=0.77,
            required_permission="cards:approve",
            payload={"vendor": "SunEdge Energy", "contract_value": 0, "monthly_savings": 420000, "payback_months": 18},
            undo_payload={},
        ),
        # Chiller preventive maintenance
        dict(
            engine="asset.anomaly",
            kind=act.CardKind.WORK_ORDER,
            status=act.CardStatus.PENDING,
            title="Chiller Unit #1: Preventive Overhaul Before Warranty Expiry",
            summary=(
                "Vibration telemetry on CHL-01 shows a +0.12g/week trend over the past 14 days, "
                "approaching the 3.8 mm/s manufacturer threshold. Compressor warranty expires in "
                "47 days. Scheduling a warranty-covered overhaul now avoids a ₹12.5L emergency "
                "rebuild if the unit fails mid-summer peak. Recommended: schedule within 10 days."
            ),
            drivers=[
                {"label": "Vibration Trend +0.12g/wk", "detail": "14-day upward drift detected on CHL-01 vibration sensor", "weight": 0.50},
                {"label": "47 Days to Warranty Expiry", "detail": "OEM warranty covers compressor replacement at zero cost until expiry", "weight": 0.35},
                {"label": "Peak Summer Risk", "detail": "Chiller failure in May-Jun peak season means 8+ hours downtime, 80+ room impact", "weight": 0.15},
            ],
            confidence=0.85,
            impact_amount=Decimal("1250000"),
            urgency=act.Urgency.CRITICAL,
            score=0.90,
            required_permission="cards:approve",
            payload={"asset_code": "CHL-01", "asset_name": "Chiller Unit 1", "action": "warranty_overhaul", "days_to_warranty_expiry": 47},
            undo_payload={},
        ),
        # Executive suite refurbishment
        dict(
            engine="revenue.demand",
            kind=act.CardKind.RATE_CHANGE,
            status=act.CardStatus.PENDING,
            title="Club Room Discount: Absorb Monsoon Trough (Jun 1–30)",
            summary=(
                "June occupancy forecast for Club Rooms is 58% — 22 points below the annual "
                "average. Peer hotels are running 12–18% OTA discounts. Offering a ₹3,200 "
                "off-peak discount on Club Rooms via OTA channel for Jun 1–30 is projected to "
                "lift occupancy to 72%, recovering ₹2.1L of lost RevPAR."
            ),
            drivers=[
                {"label": "58% Projected June Occupancy", "detail": "AI demand model lower-bound for Club category in monsoon trough", "weight": 0.45},
                {"label": "Competitor OTA Discounting", "detail": "Novotel and Sea Breeze both running 15%+ off-peak promotions", "weight": 0.35},
                {"label": "RevPAR Recovery ₹2.1L", "detail": "Modelled uplift from 58% to 72% occupancy on 55 Club rooms", "weight": 0.20},
            ],
            confidence=0.79,
            impact_amount=Decimal("210000"),
            urgency=act.Urgency.MEDIUM,
            score=0.62,
            required_permission="cards:approve",
            payload={"category": "club", "discount_amount": 3200, "channel": "ota", "start_date": str(today + timedelta(days=65)), "end_date": str(today + timedelta(days=95))},
            undo_payload={},
        ),
        # F&B staff augmentation
        dict(
            engine="workforce.gap",
            kind=act.CardKind.STAFFING_GAP,
            status=act.CardStatus.PENDING,
            title="F&B Staffing Gap: Add 4 Banquet Stewards for Oct Peak",
            summary=(
                "October banquet bookings are at 87% of hall capacity for all Saturdays. "
                "Current banquet roster of 12 stewards is insufficient for 3-hall concurrent "
                "operation. AI recommends hiring 4 temporary stewards from Oct 1–Nov 15, "
                "preventing service failure risk across 8 high-value events."
            ),
            drivers=[
                {"label": "87% Banquet Hall Booking Pace", "detail": "All Oct Saturdays at capacity; 3 simultaneous hall bookings pending", "weight": 0.50},
                {"label": "12 Stewards vs 16 Required", "detail": "SLA model requires 4 stewards per 100 covers; Oct events average 480 covers", "weight": 0.35},
                {"label": "8 High-Value Events at Risk", "detail": "Average banquet billing ₹2.8L per event — total exposure ₹22.4L", "weight": 0.15},
            ],
            confidence=0.82,
            impact_amount=Decimal("2240000"),
            urgency=act.Urgency.HIGH,
            score=0.72,
            required_permission="cards:approve",
            payload={"department": "fnb", "headcount": 4, "role": "Banquet Steward", "start_date": str(today + timedelta(days=5)), "end_date": str(today + timedelta(days=50))},
            undo_payload={},
        ),
        # One already-executed card to show history
        dict(
            engine="inventory.restock",
            kind=act.CardKind.PURCHASE,
            status=act.CardStatus.EXECUTED,
            title="Emergency Restock: Coffee Beans (Coorg Roasters)",
            summary=(
                "Coffee bean stock fell to 6 kg — below the 8 kg minimum. At current room service "
                "consumption of 1.8 kg/day, a stockout was imminent within 3 days. AI triggered "
                "an emergency 25 kg reorder from Coorg Roasters."
            ),
            drivers=[
                {"label": "Stock Below Minimum (6/8 kg)", "detail": "BV-COFFEE dropped below reorder threshold", "weight": 0.70},
                {"label": "3-Day Stockout Risk", "detail": "1.8 kg/day room service consumption rate", "weight": 0.30},
            ],
            confidence=0.97,
            impact_amount=Decimal("31250"),
            urgency=act.Urgency.HIGH,
            score=0.95,
            required_permission="cards:approve",
            payload={"sku": "BV-COFFEE", "quantity": 25, "supplier": "Coorg Roasters", "unit_cost": 1250},
            undo_payload={"sku": "BV-COFFEE", "restore_quantity": 6},
            decided_at=utcnow() - timedelta(hours=6),
            executed_at=utcnow() - timedelta(hours=5),
            decided_by=gm_user.id,
        ),
    ]

    action_cards_seeded = 0
    for card_data in owner_action_cards:
        decided_at = card_data.pop("decided_at", None)
        executed_at = card_data.pop("executed_at", None)
        decided_by = card_data.pop("decided_by", None)
        card = act.ActionCard(
            property_id=pid,
            **card_data,
        )
        if decided_at:
            card.decided_at = decided_at
        if executed_at:
            card.executed_at = executed_at
        if decided_by:
            card.decided_by = decided_by
        db.add(card)
        action_cards_seeded += 1
    db.flush()
    counts["action_cards"] = action_cards_seeded

    # --- concierge knowledge base -------------------------------------------------
    for title, content, category in KNOWLEDGE:
        db.add(
            gi.KnowledgePassage(
                property_id=pid, title=title, content=content, category=category
            )
        )
    counts["knowledge_passages"] = len(KNOWLEDGE)

    db.commit()

    # --- food & beverage order book and guest spend history -----------------------
    try:
        from seed_fnb import seed_fnb_data
    except ImportError:
        from scripts.seed_fnb import seed_fnb_data
    fnb_counts = seed_fnb_data(db, property_id=pid)
    counts.update(fnb_counts)

    from scripts.seed_staff_tasks import seed_claimable_work, seed_staff_tasks
    assignment_counts = seed_staff_tasks(db, pid)
    counts["assigned_staff_tasks"] = assignment_counts["tasks_added"]
    pool_counts = seed_claimable_work(db, pid)
    counts["claimable_staff_tasks"] = pool_counts["claimable_added"]

    # Finish the single-command demo with linked guest, staff and manager stories.
    # Their stable IDs make the ordinary rerun safe after an interrupted first run.
    from scripts.seed_workflow import seed_workflow
    workflow_result = seed_workflow(db, pid, apply=True)
    counts["workflow_rows"] = workflow_result["created"]

    return counts


if __name__ == "__main__":
    raise SystemExit(main())
