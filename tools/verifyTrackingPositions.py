"""
Cross-check the generated tracking scenarios against the raw feed: for each play,
every distinct tracked player's position in the CSV must appear in the app with the
position the mapping says it should. Catches a misconfigured PMAP, which is
otherwise invisible — the canvas shows jersey numbers, so a safety drawn as a
cornerback looks fine until you read the inspector.

    python3 tools/verifyTrackingPositions.py
"""
import csv, collections, re, sys
csv.field_size_limit(10**7)

KEYS = ['2018091606|1640', '2018091602|3122', '2018092306|3553', '2018092310|2760', '2018091300|880']
raw = collections.defaultdict(set)
for fn in ['bdbtrackingdata/week2.csv', 'bdbtrackingdata/week3.csv']:
    with open(fn) as f:
        for row in csv.DictReader(f):
            k = row['gameId'] + '|' + row['playId']
            if k in KEYS and row['position']:
                raw[k].add((row['nflId'], row['position']))   # DISTINCT PLAYERS, not distinct position strings

PMAP = {
    'QB': 'QB', 'HB': 'RB', 'RB': 'RB', 'FB': 'FB',
    'WR': 'WR', 'TE': 'TE', 'T': 'T', 'G': 'G', 'C': 'C',
    'FS': 'S', 'SS': 'S', 'S': 'S', 'CB': 'CB', 'DB': 'CB',
    'LB': 'LB', 'OLB': 'LB', 'ILB': 'LB', 'MLB': 'LB',
    'NT': 'DL', 'DL': 'DL', 'DE': 'DL',
}

src = open('src/lib/trackingScenarios.ts').read()
blocks = re.split(r"build: build\('BDB ", src)[1:]
bad = []
for b in blocks:
    key = b.split("'")[0].replace('-', '|')   # generated file uses a dash
    tok = re.findall(r"tok\('[^']+', '(offense|defense)', '([A-Z]+)'", b)
    got = collections.Counter(p for _, p in tok)
    expect = collections.Counter(PMAP.get(p, '?') for _, p in raw[key])
    ok = got == expect
    if not ok:
        bad.append(key)
    print(f"{key:20} {'OK' if ok else 'MISMATCH'}")
    if not ok:
        print(f"{'':22}app ={dict(sorted(got.items()))}")
        print(f"{'':22}feed={dict(sorted(expect.items()))}")
print()
print("mismatches:", bad or "none")
sys.exit(1 if bad else 0)