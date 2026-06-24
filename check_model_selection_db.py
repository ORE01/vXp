import sqlite3
from pathlib import Path

db_path = Path(r"C:\Users\Ronald\riskApp\electron_app\files\UNI.db")

if not db_path.exists():
    print("DB NICHT GEFUNDEN:", db_path)
    raise SystemExit(1)

conn = sqlite3.connect(db_path)
cur = conn.cursor()

print("DB:", db_path)

cur.execute("""
SELECT name
FROM sqlite_master
WHERE type='table'
ORDER BY name
""")

tables = [r[0] for r in cur.fetchall()]

print("\n=== Tabellenanzahl ===")
print(len(tables))

# ------------------------------------------------------------
# 1) Tabelle aus Screenshot suchen
# ------------------------------------------------------------
required_cols = {
    "INTERVAL_NAME",
    "START",
    "END",
    "VaR_Days",
    "Confidence",
    "red_threshold",
    "yellow_threshold",
}

print("\n=== Suche Tabelle aus dem Screenshot ===")

matches = []

for t in tables:
    cur.execute(f'PRAGMA table_info("{t}")')
    cols = [r[1] for r in cur.fetchall()]
    col_set = set(cols)

    score = len(required_cols & col_set)

    if score >= 2:
        matches.append((score, t, cols))

matches.sort(reverse=True)

for score, t, cols in matches:
    print("\nTABLE:", t)
    print("Score:", score, "/", len(required_cols))
    print("Columns:", cols)

    try:
        cur.execute(f'SELECT * FROM "{t}" LIMIT 20')
        rows = cur.fetchall()

        print("Rows:")
        for row in rows:
            print(row)
    except Exception as e:
        print("Could not read rows:", e)

# ------------------------------------------------------------
# 2) Nach sichtbaren Werten suchen
# ------------------------------------------------------------
search_values = ["STRESSED", "TEST1", "ROLLING_1", "STRESS_1"]

print("\n=== Suche nach sichtbaren INTERVAL_NAME-Werten ===")

for t in tables:
    cur.execute(f'PRAGMA table_info("{t}")')
    cols_info = cur.fetchall()
    cols = [r[1] for r in cols_info]

    for col in cols:
        try:
            placeholders = ",".join(["?"] * len(search_values))
            sql = f'SELECT COUNT(*) FROM "{t}" WHERE "{col}" IN ({placeholders})'
            cur.execute(sql, search_values)
            count = cur.fetchone()[0]

            if count > 0:
                print(f"\nFOUND in table={t}, column={col}, count={count}")

                cur.execute(
                    f'SELECT * FROM "{t}" WHERE "{col}" IN ({placeholders}) LIMIT 50',
                    search_values
                )
                rows = cur.fetchall()

                print("Columns:", cols)
                for row in rows:
                    print(row)

        except Exception:
            pass

# ------------------------------------------------------------
# 3) Nach Default-/Active-/Selected-Spalten suchen
# ------------------------------------------------------------
flag_keywords = ["DEFAULT", "ACTIVE", "SELECTED", "CURRENT", "PRIMARY", "SESSION"]

print("\n=== Suche nach Default/Active/Selected-Spalten ===")

for t in tables:
    cur.execute(f'PRAGMA table_info("{t}")')
    cols_info = cur.fetchall()
    cols = [r[1] for r in cols_info]

    matching_cols = [
        c for c in cols
        if any(k in c.upper() for k in flag_keywords)
    ]

    if matching_cols:
        print("\nTABLE:", t)
        print("Matching columns:", matching_cols)
        print("All columns:", cols)

        try:
            cur.execute(f'SELECT * FROM "{t}" LIMIT 20')
            rows = cur.fetchall()

            print("Rows:")
            for row in rows:
                print(row)
        except Exception as e:
            print("Could not read rows:", e)

conn.close()
