#!/usr/bin/env python3
"""
Preprocess world.zh.json for the World Map Game.

Operations:
1. Merge Taiwan (TW) geometry into China (CN)
2. Remove disputed -99 territories
3. Add English names, continent codes, Chinese continent names
4. Compute country adjacency graph via Shapely
5. Greedy graph coloring (6-color palette)
6. Output: world.fixed.json, capitals.json, adjacency.json
"""

import json
import os
import sys
from collections import defaultdict

from shapely.geometry import shape, MultiPolygon, Polygon
from shapely.ops import unary_union

# ── Paths ──────────────────────────────────────────────
SRC = os.path.join(os.path.dirname(__file__), '..', '..',
                   'world-geo-json-zh-main', 'world.zh.json')
DST_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

# ── Continent mapping (iso_a2 → continent_code) ─────────
CONTINENT_MAP = {
    "AF":"AS","AL":"EU","DZ":"AF","AO":"AF","AR":"SA","AM":"AS","AU":"OC",
    "AT":"EU","AZ":"AS","BH":"AS","BD":"AS","BY":"EU","BE":"EU","BZ":"NA",
    "BJ":"AF","BT":"AS","BO":"SA","BA":"EU","BW":"AF","BR":"SA","BN":"AS",
    "BG":"EU","BF":"AF","BI":"AF","KH":"AS","CM":"AF","CA":"NA","CF":"AF",
    "TD":"AF","CL":"SA","CN":"AS","CO":"SA","CG":"AF","CD":"AF","CR":"NA",
    "CI":"AF","HR":"EU","CU":"NA","CY":"EU","CZ":"EU","DK":"EU","DJ":"AF",
    "DO":"NA","EC":"SA","EG":"AF","SV":"NA","GQ":"AF","ER":"AF","EE":"EU",
    "SZ":"AF","ET":"AF","FJ":"OC","FI":"EU","FR":"EU","GA":"AF","GM":"AF",
    "GE":"AS","DE":"EU","GH":"AF","GR":"EU","GL":"NA","GT":"NA","GN":"AF",
    "GW":"AF","GY":"SA","HT":"NA","HN":"NA","HU":"EU","IS":"EU","IN":"AS",
    "ID":"AS","IR":"AS","IQ":"AS","IE":"EU","IL":"AS","IT":"EU","JM":"NA",
    "JP":"AS","JO":"AS","KZ":"AS","KE":"AF","KI":"OC","KP":"AS","KR":"AS",
    "KW":"AS","KG":"AS","LA":"AS","LV":"EU","LB":"AS","LS":"AF","LR":"AF",
    "LY":"AF","LT":"EU","LU":"EU","MG":"AF","MW":"AF","MY":"AS","MV":"AS",
    "ML":"AF","MT":"EU","MR":"AF","MU":"AF","MX":"NA","MD":"EU","MN":"AS",
    "ME":"EU","MA":"AF","MZ":"AF","MM":"AS","NA":"AF","NP":"AS","NL":"EU",
    "NZ":"OC","NI":"NA","NE":"AF","NG":"AF","MK":"EU","NO":"EU","OM":"AS",
    "PK":"AS","PA":"NA","PG":"OC","PY":"SA","PE":"SA","PH":"AS","PL":"EU",
    "PT":"EU","QA":"AS","RO":"EU","RU":"EU","RW":"AF","SA":"AS","SN":"AF",
    "RS":"EU","SL":"AF","SG":"AS","SK":"EU","SI":"EU","SB":"OC","SO":"AF",
    "ZA":"AF","SS":"AF","ES":"EU","LK":"AS","SD":"AF","SR":"SA","SE":"EU",
    "CH":"EU","SY":"AS","TJ":"AS","TZ":"AF","TH":"AS","TL":"AS","TG":"AF",
    "TT":"NA","TN":"AF","TR":"AS","TM":"AS","UG":"AF","UA":"EU","AE":"AS",
    "GB":"EU","US":"NA","UY":"SA","UZ":"AS","VU":"OC","VE":"SA","VN":"AS",
    "EH":"AF","YE":"AS","ZM":"AF","ZW":"AF","PR":"NA","PS":"AS","FK":"SA",
    "XK":"EU","NC":"OC","TW":"AS","HK":"AS","MO":"AS",
}

CONTINENT_ZH = {
    "AS": "亚洲", "EU": "欧洲", "AF": "非洲",
    "NA": "北美洲", "SA": "南美洲", "OC": "大洋洲",
    "AN": "南极洲",
}

# ── English country names (iso_a2 → name_en) ────────────
NAME_EN = {
    "AF":"Afghanistan","AL":"Albania","DZ":"Algeria","AO":"Angola",
    "AR":"Argentina","AM":"Armenia","AU":"Australia","AT":"Austria",
    "AZ":"Azerbaijan","BH":"Bahrain","BD":"Bangladesh","BY":"Belarus",
    "BE":"Belgium","BZ":"Belize","BJ":"Benin","BT":"Bhutan",
    "BO":"Bolivia","BA":"Bosnia and Herzegovina","BW":"Botswana",
    "BR":"Brazil","BN":"Brunei","BG":"Bulgaria","BF":"Burkina Faso",
    "BI":"Burundi","KH":"Cambodia","CM":"Cameroon","CA":"Canada",
    "CF":"Central African Republic","TD":"Chad","CL":"Chile","CN":"China",
    "CO":"Colombia","CG":"Congo","CD":"Democratic Republic of the Congo",
    "CR":"Costa Rica","CI":"Côte d'Ivoire","HR":"Croatia","CU":"Cuba",
    "CY":"Cyprus","CZ":"Czech Republic","DK":"Denmark","DJ":"Djibouti",
    "DO":"Dominican Republic","EC":"Ecuador","EG":"Egypt",
    "SV":"El Salvador","GQ":"Equatorial Guinea","ER":"Eritrea",
    "EE":"Estonia","SZ":"Eswatini","ET":"Ethiopia","FJ":"Fiji",
    "FI":"Finland","FR":"France","GA":"Gabon","GM":"Gambia",
    "GE":"Georgia","DE":"Germany","GH":"Ghana","GR":"Greece",
    "GL":"Greenland","GT":"Guatemala","GN":"Guinea","GW":"Guinea-Bissau",
    "GY":"Guyana","HT":"Haiti","HN":"Honduras","HU":"Hungary",
    "IS":"Iceland","IN":"India","ID":"Indonesia","IR":"Iran","IQ":"Iraq",
    "IE":"Ireland","IL":"Israel","IT":"Italy","JM":"Jamaica","JP":"Japan",
    "JO":"Jordan","KZ":"Kazakhstan","KE":"Kenya","KI":"Kiribati",
    "KP":"North Korea","KR":"South Korea","KW":"Kuwait","KG":"Kyrgyzstan",
    "LA":"Laos","LV":"Latvia","LB":"Lebanon","LS":"Lesotho","LR":"Liberia",
    "LY":"Libya","LT":"Lithuania","LU":"Luxembourg","MG":"Madagascar",
    "MW":"Malawi","MY":"Malaysia","MV":"Maldives","ML":"Mali","MT":"Malta",
    "MR":"Mauritania","MU":"Mauritius","MX":"Mexico","MD":"Moldova",
    "MN":"Mongolia","ME":"Montenegro","MA":"Morocco","MZ":"Mozambique",
    "MM":"Myanmar","NA":"Namibia","NP":"Nepal","NL":"Netherlands",
    "NZ":"New Zealand","NI":"Nicaragua","NE":"Niger","NG":"Nigeria",
    "MK":"North Macedonia","NO":"Norway","OM":"Oman","PK":"Pakistan",
    "PA":"Panama","PG":"Papua New Guinea","PY":"Paraguay","PE":"Peru",
    "PH":"Philippines","PL":"Poland","PT":"Portugal","QA":"Qatar",
    "RO":"Romania","RU":"Russia","RW":"Rwanda","SA":"Saudi Arabia",
    "SN":"Senegal","RS":"Serbia","SL":"Sierra Leone","SG":"Singapore",
    "SK":"Slovakia","SI":"Slovenia","SB":"Solomon Islands","SO":"Somalia",
    "ZA":"South Africa","SS":"South Sudan","ES":"Spain","LK":"Sri Lanka",
    "SD":"Sudan","SR":"Suriname","SE":"Sweden","CH":"Switzerland",
    "SY":"Syria","TJ":"Tajikistan","TZ":"Tanzania","TH":"Thailand",
    "TL":"Timor-Leste","TG":"Togo","TT":"Trinidad and Tobago",
    "TN":"Tunisia","TR":"Turkey","TM":"Turkmenistan","UG":"Uganda",
    "UA":"Ukraine","AE":"United Arab Emirates",
    "GB":"United Kingdom","US":"United States","UY":"Uruguay",
    "UZ":"Uzbekistan","VU":"Vanuatu","VE":"Venezuela","VN":"Vietnam",
    "EH":"Western Sahara","YE":"Yemen","ZM":"Zambia","ZW":"Zimbabwe",
    "PR":"Puerto Rico","PS":"Palestine","FK":"Falkland Islands",
    "XK":"Kosovo","NC":"New Caledonia",
}

# ── Capital mapping (iso_a2 → {capital_zh, capital_en}) ──
CAPITALS = {
    "AF": {"zh":"喀布尔","en":"Kabul"},
    "AL": {"zh":"地拉那","en":"Tirana"},
    "DZ": {"zh":"阿尔及尔","en":"Algiers"},
    "AO": {"zh":"罗安达","en":"Luanda"},
    "AR": {"zh":"布宜诺斯艾利斯","en":"Buenos Aires"},
    "AM": {"zh":"埃里温","en":"Yerevan"},
    "AU": {"zh":"堪培拉","en":"Canberra"},
    "AT": {"zh":"维也纳","en":"Vienna"},
    "AZ": {"zh":"巴库","en":"Baku"},
    "BH": {"zh":"麦纳麦","en":"Manama"},
    "BD": {"zh":"达卡","en":"Dhaka"},
    "BY": {"zh":"明斯克","en":"Minsk"},
    "BE": {"zh":"布鲁塞尔","en":"Brussels"},
    "BZ": {"zh":"贝尔莫潘","en":"Belmopan"},
    "BJ": {"zh":"波多诺伏","en":"Porto-Novo"},
    "BT": {"zh":"廷布","en":"Thimphu"},
    "BO": {"zh":"苏克雷","en":"Sucre"},
    "BA": {"zh":"萨拉热窝","en":"Sarajevo"},
    "BW": {"zh":"哈博罗内","en":"Gaborone"},
    "BR": {"zh":"巴西利亚","en":"Brasília"},
    "BN": {"zh":"斯里巴加湾","en":"Bandar Seri Begawan"},
    "BG": {"zh":"索非亚","en":"Sofia"},
    "BF": {"zh":"瓦加杜古","en":"Ouagadougou"},
    "BI": {"zh":"布琼布拉","en":"Gitega"},
    "KH": {"zh":"金边","en":"Phnom Penh"},
    "CM": {"zh":"雅温得","en":"Yaoundé"},
    "CA": {"zh":"渥太华","en":"Ottawa"},
    "CF": {"zh":"班吉","en":"Bangui"},
    "TD": {"zh":"恩贾梅纳","en":"N'Djamena"},
    "CL": {"zh":"圣地亚哥","en":"Santiago"},
    "CN": {"zh":"北京","en":"Beijing"},
    "CO": {"zh":"波哥大","en":"Bogotá"},
    "CG": {"zh":"布拉柴维尔","en":"Brazzaville"},
    "CD": {"zh":"金沙萨","en":"Kinshasa"},
    "CR": {"zh":"圣何塞","en":"San José"},
    "CI": {"zh":"亚穆苏克罗","en":"Yamoussoukro"},
    "HR": {"zh":"萨格勒布","en":"Zagreb"},
    "CU": {"zh":"哈瓦那","en":"Havana"},
    "CY": {"zh":"尼科西亚","en":"Nicosia"},
    "CZ": {"zh":"布拉格","en":"Prague"},
    "DK": {"zh":"哥本哈根","en":"Copenhagen"},
    "DJ": {"zh":"吉布提","en":"Djibouti"},
    "DO": {"zh":"圣多明各","en":"Santo Domingo"},
    "EC": {"zh":"基多","en":"Quito"},
    "EG": {"zh":"开罗","en":"Cairo"},
    "SV": {"zh":"圣萨尔瓦多","en":"San Salvador"},
    "GQ": {"zh":"马拉博","en":"Malabo"},
    "ER": {"zh":"阿斯马拉","en":"Asmara"},
    "EE": {"zh":"塔林","en":"Tallinn"},
    "SZ": {"zh":"姆巴巴内","en":"Mbabane"},
    "ET": {"zh":"亚的斯亚贝巴","en":"Addis Ababa"},
    "FJ": {"zh":"苏瓦","en":"Suva"},
    "FI": {"zh":"赫尔辛基","en":"Helsinki"},
    "FR": {"zh":"巴黎","en":"Paris"},
    "GA": {"zh":"利伯维尔","en":"Libreville"},
    "GM": {"zh":"班珠尔","en":"Banjul"},
    "GE": {"zh":"第比利斯","en":"Tbilisi"},
    "DE": {"zh":"柏林","en":"Berlin"},
    "GH": {"zh":"阿克拉","en":"Accra"},
    "GR": {"zh":"雅典","en":"Athens"},
    "GL": {"zh":"努克","en":"Nuuk"},
    "GT": {"zh":"危地马拉城","en":"Guatemala City"},
    "GN": {"zh":"科纳克里","en":"Conakry"},
    "GW": {"zh":"比绍","en":"Bissau"},
    "GY": {"zh":"乔治敦","en":"Georgetown"},
    "HT": {"zh":"太子港","en":"Port-au-Prince"},
    "HN": {"zh":"特古西加尔巴","en":"Tegucigalpa"},
    "HU": {"zh":"布达佩斯","en":"Budapest"},
    "IS": {"zh":"雷克雅未克","en":"Reykjavik"},
    "IN": {"zh":"新德里","en":"New Delhi"},
    "ID": {"zh":"雅加达","en":"Jakarta"},
    "IR": {"zh":"德黑兰","en":"Tehran"},
    "IQ": {"zh":"巴格达","en":"Baghdad"},
    "IE": {"zh":"都柏林","en":"Dublin"},
    "IL": {"zh":"耶路撒冷","en":"Jerusalem"},
    "IT": {"zh":"罗马","en":"Rome"},
    "JM": {"zh":"金斯敦","en":"Kingston"},
    "JP": {"zh":"东京","en":"Tokyo"},
    "JO": {"zh":"安曼","en":"Amman"},
    "KZ": {"zh":"阿斯塔纳","en":"Astana"},
    "KE": {"zh":"内罗毕","en":"Nairobi"},
    "KI": {"zh":"塔拉瓦","en":"Tarawa"},
    "KP": {"zh":"平壤","en":"Pyongyang"},
    "KR": {"zh":"首尔","en":"Seoul"},
    "KW": {"zh":"科威特城","en":"Kuwait City"},
    "KG": {"zh":"比什凯克","en":"Bishkek"},
    "LA": {"zh":"万象","en":"Vientiane"},
    "LV": {"zh":"里加","en":"Riga"},
    "LB": {"zh":"贝鲁特","en":"Beirut"},
    "LS": {"zh":"马塞卢","en":"Maseru"},
    "LR": {"zh":"蒙罗维亚","en":"Monrovia"},
    "LY": {"zh":"的黎波里","en":"Tripoli"},
    "LT": {"zh":"维尔纽斯","en":"Vilnius"},
    "LU": {"zh":"卢森堡市","en":"Luxembourg City"},
    "MG": {"zh":"塔那那利佛","en":"Antananarivo"},
    "MW": {"zh":"利隆圭","en":"Lilongwe"},
    "MY": {"zh":"吉隆坡","en":"Kuala Lumpur"},
    "MV": {"zh":"马累","en":"Malé"},
    "ML": {"zh":"巴马科","en":"Bamako"},
    "MT": {"zh":"瓦莱塔","en":"Valletta"},
    "MR": {"zh":"努瓦克肖特","en":"Nouakchott"},
    "MU": {"zh":"路易港","en":"Port Louis"},
    "MX": {"zh":"墨西哥城","en":"Mexico City"},
    "MD": {"zh":"基希讷乌","en":"Chișinău"},
    "MN": {"zh":"乌兰巴托","en":"Ulaanbaatar"},
    "ME": {"zh":"波德戈里察","en":"Podgorica"},
    "MA": {"zh":"拉巴特","en":"Rabat"},
    "MZ": {"zh":"马普托","en":"Maputo"},
    "MM": {"zh":"内比都","en":"Naypyidaw"},
    "NA": {"zh":"温得和克","en":"Windhoek"},
    "NP": {"zh":"加德满都","en":"Kathmandu"},
    "NL": {"zh":"阿姆斯特丹","en":"Amsterdam"},
    "NZ": {"zh":"惠灵顿","en":"Wellington"},
    "NI": {"zh":"马那瓜","en":"Managua"},
    "NE": {"zh":"尼亚美","en":"Niamey"},
    "NG": {"zh":"阿布贾","en":"Abuja"},
    "MK": {"zh":"斯科普里","en":"Skopje"},
    "NO": {"zh":"奥斯陆","en":"Oslo"},
    "OM": {"zh":"马斯喀特","en":"Muscat"},
    "PK": {"zh":"伊斯兰堡","en":"Islamabad"},
    "PA": {"zh":"巴拿马城","en":"Panama City"},
    "PG": {"zh":"莫尔兹比港","en":"Port Moresby"},
    "PY": {"zh":"亚松森","en":"Asunción"},
    "PE": {"zh":"利马","en":"Lima"},
    "PH": {"zh":"马尼拉","en":"Manila"},
    "PL": {"zh":"华沙","en":"Warsaw"},
    "PT": {"zh":"里斯本","en":"Lisbon"},
    "QA": {"zh":"多哈","en":"Doha"},
    "RO": {"zh":"布加勒斯特","en":"Bucharest"},
    "RU": {"zh":"莫斯科","en":"Moscow"},
    "RW": {"zh":"基加利","en":"Kigali"},
    "SA": {"zh":"利雅得","en":"Riyadh"},
    "SN": {"zh":"达喀尔","en":"Dakar"},
    "RS": {"zh":"贝尔格莱德","en":"Belgrade"},
    "SL": {"zh":"弗里敦","en":"Freetown"},
    "SG": {"zh":"新加坡","en":"Singapore"},
    "SK": {"zh":"布拉迪斯拉发","en":"Bratislava"},
    "SI": {"zh":"卢布尔雅那","en":"Ljubljana"},
    "SB": {"zh":"霍尼亚拉","en":"Honiara"},
    "SO": {"zh":"摩加迪沙","en":"Mogadishu"},
    "ZA": {"zh":"比勒陀利亚","en":"Pretoria"},
    "SS": {"zh":"朱巴","en":"Juba"},
    "ES": {"zh":"马德里","en":"Madrid"},
    "LK": {"zh":"科伦坡","en":"Sri Jayawardenepura Kotte"},
    "SD": {"zh":"喀土穆","en":"Khartoum"},
    "SR": {"zh":"帕拉马里博","en":"Paramaribo"},
    "SE": {"zh":"斯德哥尔摩","en":"Stockholm"},
    "CH": {"zh":"伯尔尼","en":"Bern"},
    "SY": {"zh":"大马士革","en":"Damascus"},
    "TJ": {"zh":"杜尚别","en":"Dushanbe"},
    "TZ": {"zh":"多多马","en":"Dodoma"},
    "TH": {"zh":"曼谷","en":"Bangkok"},
    "TL": {"zh":"帝力","en":"Dili"},
    "TG": {"zh":"洛美","en":"Lomé"},
    "TT": {"zh":"西班牙港","en":"Port of Spain"},
    "TN": {"zh":"突尼斯","en":"Tunis"},
    "TR": {"zh":"安卡拉","en":"Ankara"},
    "TM": {"zh":"阿什哈巴德","en":"Ashgabat"},
    "UG": {"zh":"坎帕拉","en":"Kampala"},
    "UA": {"zh":"基辅","en":"Kyiv"},
    "AE": {"zh":"阿布扎比","en":"Abu Dhabi"},
    "GB": {"zh":"伦敦","en":"London"},
    "US": {"zh":"华盛顿","en":"Washington, D.C."},
    "UY": {"zh":"蒙得维的亚","en":"Montevideo"},
    "UZ": {"zh":"塔什干","en":"Tashkent"},
    "VU": {"zh":"维拉港","en":"Port Vila"},
    "VE": {"zh":"加拉加斯","en":"Caracas"},
    "VN": {"zh":"河内","en":"Hanoi"},
    "EH": {"zh":"阿尤恩","en":"Laayoune"},
    "YE": {"zh":"萨那","en":"Sana'a"},
    "ZM": {"zh":"卢萨卡","en":"Lusaka"},
    "ZW": {"zh":"哈拉雷","en":"Harare"},
    "PR": {"zh":"圣胡安","en":"San Juan"},
    "PS": {"zh":"拉马拉","en":"Ramallah"},
    "FK": {"zh":"斯坦利","en":"Stanley"},
    "XK": {"zh":"普里什蒂纳","en":"Pristina"},
    "NC": {"zh":"努美阿","en":"Nouméa"},
}


def load_geojson(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(obj, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    print(f"  [OK] saved {os.path.basename(path)} ({len(obj.get('features', obj))} entries)")


def find_feature(features, iso_a2):
    for i, f in enumerate(features):
        if f['properties']['iso_a2'] == iso_a2:
            return i, f
    return None, None


def merge_geometries(geom_a, geom_b):
    """Merge two GeoJSON geometry objects (Polygon or MultiPolygon) into one."""
    shape_a = shape(geom_a)
    shape_b = shape(geom_b)
    merged = unary_union([shape_a, shape_b])

    from shapely.geometry import mapping
    return mapping(merged)


def polygon_area_sq_deg(geom):
    """Very rough area estimate in square-degrees (NOT square-km)."""
    s = shape(geom)
    return s.area


# ── Step 1: Load ──────────────────────────────────────
print("Loading world.zh.json...")
data = load_geojson(SRC)
features = data['features']
print(f"  loaded {len(features)} features")

# ── Step 2: Merge Taiwan into China ───────────────────
print("\nMerging Taiwan (TW) into China (CN)...")
tw_idx, tw_feat = find_feature(features, 'TW')
cn_idx, cn_feat = find_feature(features, 'CN')

if tw_feat and cn_feat:
    merged_geom = merge_geometries(cn_feat['geometry'], tw_feat['geometry'])
    cn_feat['geometry'] = merged_geom
    # Remove Taiwan from features
    del features[tw_idx]
    print(f"  merged TW → CN, removed Taiwan feature. Remaining: {len(features)}")
else:
    print(f"  WARNING: TW found={tw_feat is not None}, CN found={cn_feat is not None}")

# ── Step 3: Mark -99 territories as disputed (keep them, special rendering) ──
print("\nMarking disputed -99 territories...")
for f in features:
    if f['properties']['iso_a2'] == '-99':
        f['properties']['disputed'] = True
        print(f"  marked disputed: {f['properties']['name']}")
    else:
        f['properties']['disputed'] = False
disputed_count = sum(1 for f in features if f['properties'].get('disputed'))
regular_count = len(features) - disputed_count
print(f"  {regular_count} regular + {disputed_count} disputed territories")

# ── Step 3b: Fix China-India border (藏南 + 阿克赛钦) ──
print("\nFixing China-India border (Zangnan / South Tibet + Aksai Chin)...")
cn_idx, cn_feat = find_feature(features, 'CN')
in_idx, in_feat = find_feature(features, 'IN')

if cn_feat and in_feat:
    from shapely.geometry import Polygon as ShapelyPolygon

    # --- South Tibet / 藏南 (Arunachal Pradesh) correction polygon ---
    # High-density polygon (~50 points) — edges extended to cover all fragments
    # West: 91.0°E (covers BT-CN-IN tri-junction, doesn't cut Bhutan)
    # East: 98.0°E (covers CN-MM-IN tri-junction)
    # South: Brahmaputra valley (~27°N)  |  North: well above McMahon Line (30°N)
    zangnan_poly = ShapelyPolygon([
        # West edge — extends to 91.0°E to cover BT tri-junction
        (91.00, 30.00),
        (91.00, 28.50),
        (91.10, 28.30),
        (91.20, 28.10),
        (91.30, 27.90),
        (91.40, 27.70),
        (91.50, 27.50),
        (91.60, 27.30),
        (91.70, 27.10),
        (91.80, 26.95),
        (91.90, 26.92),
        # South edge — Brahmaputra valley, extended further south for full coverage
        (92.30, 26.40),
        (92.80, 26.50),
        (93.30, 26.60),
        (93.80, 26.72),
        (94.30, 26.82),
        (94.80, 26.92),
        (95.30, 27.00),
        (95.80, 27.05),
        (96.30, 27.02),
        (96.80, 26.95),
        (97.20, 26.85),
        (97.80, 26.75),
        (98.00, 26.70),
        # East edge — extends to 98°E to cover MM tri-junction
        (98.00, 27.60),
        (98.00, 27.90),
        (98.00, 28.20),
        (98.00, 28.50),
        (98.00, 28.80),
        (98.00, 29.10),
        (98.00, 29.50),
        (98.00, 30.00),
        # North edge
        (98.00, 30.00),
        (97.00, 30.00),
        (96.00, 30.00),
        (95.00, 30.00),
        (94.00, 30.00),
        (93.00, 30.00),
        (92.00, 30.00),
        (91.00, 30.00),
    ])

    # --- Aksai Chin correction polygon ---
    # ~35 points — expanded north to 37.5°N and east to 83°E for full connectivity
    aksai_poly = ShapelyPolygon([
        # Top edge — extends well into Xinjiang for guaranteed connectivity
        (75.00, 37.50),
        (77.00, 37.50),
        (79.00, 37.50),
        (81.00, 37.50),
        (83.00, 37.50),
        # Right edge — extends to 83°E for full corridor
        (83.00, 37.00),
        (83.00, 36.50),
        (83.00, 36.00),
        (83.00, 35.50),
        (83.00, 35.00),
        (83.00, 34.50),
        (83.00, 34.00),
        (82.50, 33.70),
        (82.00, 33.50),
        (81.50, 33.42),
        (81.00, 33.38),
        (80.50, 33.40),
        (80.00, 33.45),
        (79.50, 33.52),
        (79.00, 33.62),
        (78.50, 33.75),
        (78.00, 33.90),
        (77.50, 34.05),
        (77.00, 34.22),
        (76.50, 34.40),
        (76.00, 34.60),
        (75.50, 34.85),
        (75.00, 35.10),
        # Bottom edge
        (75.00, 35.50),
        (75.00, 36.00),
        (75.00, 36.50),
        (75.00, 37.00),
        (75.00, 37.50),
    ])

    combined_claim = zangnan_poly.union(aksai_poly)

    # Get current geometries
    cn_geom = shape(cn_feat['geometry'])
    in_geom = shape(in_feat['geometry'])

    # Only take the part of the claim that is currently inside India
    claim_in_india = combined_claim.intersection(in_geom)
    if not claim_in_india.is_empty:
        # Subtract claimed area from India
        in_new = in_geom.difference(combined_claim)
        # Add claimed area to China
        cn_new = unary_union([cn_geom, claim_in_india])

        # Post-processing: find any small India fragments near China and merge them
        if hasattr(in_new, 'geoms'):
            # India is MultiPolygon — check each sub-polygon
            main_parts = []
            frag_parts = []
            for g in in_new.geoms:
                # Fragment if: small area, touches/close to China, in disputed region
                is_frag = False
                if g.area < 5.0:  # Less than 5 deg²
                    dist_to_cn = g.boundary.distance(cn_new.boundary)
                    if dist_to_cn < 0.5:  # Very close to or touching China
                        is_frag = True
                if is_frag:
                    frag_parts.append(g)
                else:
                    main_parts.append(g)
            if frag_parts:
                print(f"  Merging {len(frag_parts)} Indian fragment(s) into China (total area: {sum(g.area for g in frag_parts):.3f} deg²)")
                for g in frag_parts:
                    cn_new = unary_union([cn_new, g])
                # Rebuild India without fragments
                if main_parts:
                    from shapely.geometry import MultiPolygon as ShapelyMP
                    in_new = ShapelyMP(main_parts) if len(main_parts) > 1 else main_parts[0]
                else:
                    # All parts were fragments — unlikely but handle
                    in_new = main_parts[0] if main_parts else in_new

        # Simplify to smooth jagged edges (tolerance 0.015 deg ≈ 1.7 km)
        cn_new = cn_new.simplify(0.015, preserve_topology=True)
        in_new = in_new.simplify(0.015, preserve_topology=True)

        # Convert back to GeoJSON geometry
        from shapely.geometry import mapping as geo_mapping
        cn_feat['geometry'] = geo_mapping(cn_new)
        in_feat['geometry'] = geo_mapping(in_new)

        cn_area_before = cn_geom.area
        cn_area_after = cn_new.area
        print(f"  藏南 + 阿克赛钦 已修正 ({len(zangnan_poly.exterior.coords)} pts / {len(aksai_poly.exterior.coords)} pts)")
        print(f"    China area: {cn_area_before:.1f} → {cn_area_after:.1f} sq deg")
    else:
        print(f"  WARNING: claim area does not intersect India — border may already be correct")
else:
    print(f"  WARNING: CN found={cn_feat is not None}, IN found={in_feat is not None}")

# ── Step 4: Add metadata ──────────────────────────────
print("\nAdding metadata (name_en, continent, capital)...")
for f in features:
    props = f['properties']
    iso = props['iso_a2']

    # English name
    props['name_en'] = NAME_EN.get(iso, props['name'])

    # Continent
    cont_code = CONTINENT_MAP.get(iso, 'XX')
    props['continent'] = cont_code
    props['continent_zh'] = CONTINENT_ZH.get(cont_code, '未知')

    # Capital
    cap = CAPITALS.get(iso, {})
    props['capital_zh'] = cap.get('zh', '')
    props['capital_en'] = cap.get('en', '')

print(f"  metadata added to {len(features)} features")

# ── Step 5: Country area estimation ───────────────────
print("\nEstimating country areas...")
for f in features:
    area = polygon_area_sq_deg(f['geometry'])
    f['properties']['area_sq_deg'] = area

# Sort by area for difficulty filtering later
area_ranked = sorted(features, key=lambda f: f['properties']['area_sq_deg'], reverse=True)
for rank, f in enumerate(area_ranked):
    f['properties']['area_rank'] = rank + 1  # 1 = largest

print(f"  largest: {area_ranked[0]['properties']['name']} ({area_ranked[0]['properties']['area_sq_deg']:.1f})")
print(f"  smallest: {area_ranked[-1]['properties']['name']} ({area_ranked[-1]['properties']['area_sq_deg']:.5f})")
print(f"  top-40 (easy difficulty threshold): {area_ranked[39]['properties']['name']}")

# ── Step 6: Adjacency graph ───────────────────────────
print("\nComputing adjacency graph...")
geoms = []
iso_list = []
is_disputed = []  # track which features are disputed
for f in features:
    iso_list.append(f['properties']['iso_a2'])
    geoms.append(shape(f['geometry']))
    is_disputed.append(f['properties'].get('disputed', False))

adjacency = defaultdict(list)
total_pairs = len(geoms) * (len(geoms) - 1) // 2
checked = 0

# Use spatial index via STRtree for performance
import shapely
strtree = shapely.STRtree(geoms)

for i in range(len(geoms)):
    # Skip disputed territories for adjacency
    if is_disputed[i]:
        continue
    # Query candidates with expanded bbox buffer to catch island-mainland proximity
    candidates = strtree.query(geoms[i].buffer(0.8))
    for j in candidates:
        if j <= i:
            continue
        if is_disputed[j]:
            continue
        checked += 1
        try:
            # Use boundary distance as primary check (handles island nations)
            boundary_dist = geoms[i].boundary.distance(geoms[j].boundary)
            # 3.0 deg ≈ 330 km — catches ID-AU, PH-VN, and more island adjacencies
            if boundary_dist < 3.0:
                if not geoms[i].contains(geoms[j]) and not geoms[j].contains(geoms[i]):
                    adjacency[iso_list[i]].append(iso_list[j])
                    adjacency[iso_list[j]].append(iso_list[i])
        except Exception:
            pass

# Manual adjacency injection for key island pairs the distance threshold can't catch
manual_pairs = [
    ('PH', 'ID'),   # 3.95 deg gap — visual proximity across Celebes Sea
    ('PH', 'VN'),   # South China Sea neighbors
    ('ID', 'AU'),   # Timor Sea — visual proximity at world scale
    ('MY', 'VN'),   # South China Sea
    ('JP', 'KP'),   # Sea of Japan
    ('JP', 'KR'),   # Already caught? safety check
    ('LK', 'IN'),   # Sri Lanka-India (should already be caught but ensure)
]
for a, b in manual_pairs:
    if a in iso_list and b in iso_list:
        if b not in adjacency[a]:
            adjacency[a].append(b)
            adjacency[b].append(a)

adj_count = sum(len(v) for v in adjacency.values()) // 2
print(f"  found {adj_count} adjacency pairs among {len(geoms)} countries (after manual injection)")
# Debug: top-5 most connected
most_connected = sorted(adjacency.items(), key=lambda x: len(x[1]), reverse=True)[:5]
for iso, neighbors in most_connected:
    name = next(f['properties']['name'] for f in features if f['properties']['iso_a2'] == iso)
    print(f"    {name} ({iso}): {len(neighbors)} neighbors")

# ── Step 7: Greedy graph coloring ─────────────────────
print("\nApplying greedy graph coloring...")
PALETTE_SIZE = 12
# Sort by degree (most neighbors first) — Welsh-Powell heuristic
sorted_countries = sorted(adjacency.keys(), key=lambda k: len(adjacency[k]), reverse=True)
color_assignment = {}

for iso in sorted_countries:
    neighbor_colors = {color_assignment[n] for n in adjacency[iso] if n in color_assignment}
    # Pick the lowest available color
    for c in range(PALETTE_SIZE):
        if c not in neighbor_colors:
            color_assignment[iso] = c
            break
    else:
        # Should not happen with 6 colors for a planar-ish graph
        color_assignment[iso] = 0

# Assign colors to isolated countries (no detected neighbors)
for iso in iso_list:
    if iso not in color_assignment:
        color_assignment[iso] = 0

# Count color usage
color_counts = defaultdict(int)
for c in color_assignment.values():
    color_counts[c] += 1
print(f"  color distribution: {dict(color_counts)}")

# Write color_index into features
for f in features:
    iso = f['properties']['iso_a2']
    if f['properties'].get('disputed'):
        f['properties']['color_index'] = -1  # Special: rendered as gray
    else:
        f['properties']['color_index'] = color_assignment.get(iso, 0)

# ── Step 8: Output files ──────────────────────────────
print("\nWriting output files...")

# world.fixed.json
output_geojson = {
    "type": "FeatureCollection",
    "features": features,
}
save_json(output_geojson, os.path.join(DST_DIR, 'world.fixed.json'))

# capitals.json
capitals_out = {}
for f in features:
    iso = f['properties']['iso_a2']
    capitals_out[iso] = {
        "zh": f['properties']['capital_zh'],
        "en": f['properties']['capital_en'],
    }
save_json(capitals_out, os.path.join(DST_DIR, 'capitals.json'))

# adjacency.json
save_json(dict(adjacency), os.path.join(DST_DIR, 'adjacency.json'))

# ── Done ──────────────────────────────────────────────
print(f"\n[DONE] Preprocessing complete! {len(features)} countries ready.")
print(f"   Output directory: {DST_DIR}")
