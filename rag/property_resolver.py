"""
CrestMind AI — Property Resolver

Resolves natural language property references (including shorthand names,
nicknames, and partial matches) to actual property records in the database.

Examples:
  "Akers"        → Akers Center (NC)
  "Parkplace"    → Parkplace Plaza (TX)  [low confidence → ask user]
  "the Morton IL store" → Field Shopping Center, Morton IL
"""

import re
from difflib import SequenceMatcher
from db.client import get_supabase


# ── Confidence thresholds ──────────────────────────────────────────────
# Measured against the live property list: unrelated names ("Ollie's",
# "TMT", "Sunset Mall") score 0.30–0.50 against random properties, while
# real references ("Akers", "Maple Ridge", "Morton IL") score >= 0.85.
# The old 0.45 medium band sat inside the noise, so tenant and vendor
# names came back as "ambiguous" with three unrelated properties.
HIGH_CONFIDENCE   = 0.75   # return directly (unless a runner-up is as good)
MEDIUM_CONFIDENCE = 0.65   # return with warning
AMBIGUITY_MARGIN  = 0.10   # runner-up this close to the winner -> ask user


def _normalize(text: str) -> str:
    """Lowercase, strip common filler words for better fuzzy matching."""
    text = text.lower().strip()
    stopwords = [
        'shopping center', 'plaza', 'centre', 'mall', 'the ',
        'llc', 'lp', 'inc', 'corp', 'limited', 'partners',
        'woodcrest', ' at ', ' of ', ' in ',
    ]
    for sw in stopwords:
        text = text.replace(sw, ' ')
    # collapse whitespace
    return re.sub(r'\s+', ' ', text).strip()


def _similarity(a: str, b: str) -> float:
    """Return 0-1 similarity between two strings."""
    return SequenceMatcher(None, _normalize(a), _normalize(b)).ratio()


def _score_property(query: str, prop: dict) -> float:
    """Return best similarity score across all name fields of a property."""
    candidates = [
        prop.get('name', ''),
        prop.get('entity_name', ''),
        prop.get('city', ''),
    ]
    # Also check city+state combo e.g. "Morton IL"
    if prop.get('city') and prop.get('state'):
        candidates.append(f"{prop['city']} {prop['state']}")

    scores = [_similarity(query, c) for c in candidates if c]

    # Bonus: if query string is a substring of the name
    norm_query = _normalize(query)
    norm_name  = _normalize(prop.get('name', ''))
    if norm_query and norm_query in norm_name:
        scores.append(0.85)

    return max(scores) if scores else 0.0


def resolve_property(query: str) -> dict:
    """
    Resolve a natural language property reference to a database record.

    Returns
    -------
    {
        "status": "found" | "ambiguous" | "not_found",
        "property": { ...db row } | None,
        "candidates": [ ...top matches ] | [],
        "confidence": float,
        "message": str   # human-readable explanation
    }
    """
    if not query or not query.strip():
        return {
            "status": "not_found",
            "property": None,
            "candidates": [],
            "confidence": 0.0,
            "message": "No property name provided.",
        }

    supabase = get_supabase()

    # Fetch all properties (master list is ~300 rows — fine to load all)
    result = supabase.table("properties").select("*").execute()
    all_properties = result.data or []

    if not all_properties:
        return {
            "status": "not_found",
            "property": None,
            "candidates": [],
            "confidence": 0.0,
            "message": "No properties found in database.",
        }

    # Score every property
    scored = [
        (prop, _score_property(query, prop))
        for prop in all_properties
    ]
    scored.sort(key=lambda x: x[1], reverse=True)

    top_score  = scored[0][1]
    top_prop   = scored[0][0]
    top_3      = scored[:3]

    close_matches = [
        p for p, score in top_3
        if score >= MEDIUM_CONFIDENCE and score >= top_score - AMBIGUITY_MARGIN
    ]

    # ── Ambiguous: two or more properties match about equally well ──
    # Checked in the high band too: "Park Place" scores 0.95 against
    # "Parkplace Plaza" and 0.85 against "Park Place Center"; silently
    # picking one answers questions about the wrong property.
    if top_score >= MEDIUM_CONFIDENCE and len(close_matches) > 1:
        return {
            "status": "ambiguous",
            "property": None,
            "candidates": close_matches,
            "confidence": top_score,
            "message": (
                f"Found multiple possible matches for '{query}'. "
                "Please clarify which property you mean."
            ),
        }

    # ── High confidence: clear winner ──
    if top_score >= HIGH_CONFIDENCE:
        return {
            "status": "found",
            "property": top_prop,
            "candidates": [],
            "confidence": top_score,
            "message": f"Matched to: {top_prop['name']} ({top_prop.get('state', '')})",
        }

    # ── Medium confidence: single best match, with a warning ──
    if top_score >= MEDIUM_CONFIDENCE:
        return {
            "status": "found",
            "property": top_prop,
            "candidates": [],
            "confidence": top_score,
            "message": (
                f"Best match: {top_prop['name']} ({top_prop.get('state', '')}). "
                "If this is incorrect, please specify the full property name."
            ),
        }

    # ── Low confidence: no good match ──
    return {
        "status": "not_found",
        "property": None,
        "candidates": [p for p, score in top_3 if score > 0.2],
        "confidence": top_score,
        "message": (
            f"Could not identify a property matching '{query}'. "
            "Please provide the full property name or location."
        ),
    }


def get_property_by_id(property_id: str) -> dict | None:
    """Fetch a single property record by UUID."""
    supabase = get_supabase()
    result = (
        supabase.table("properties")
        .select("*")
        .eq("id", property_id)
        .single()
        .execute()
    )
    return result.data


def get_properties_by_state(state: str) -> list[dict]:
    """Fetch all active properties in a given state."""
    supabase = get_supabase()
    result = (
        supabase.table("properties")
        .select("*")
        .eq("state", state.upper())
        .execute()
    )
    return result.data or []


def format_property_status_warning(prop: dict) -> str | None:
    """
    Return a warning string if the property has a non-active status.
    Returns None for active properties (no warning needed).
    """
    status = prop.get("status", "active")

    if status == "sold":
        sold_date = prop.get("sold_date", "unknown date")
        return (
            f"⚠️ Note: {prop['name']} was sold on {sold_date}. "
            "This answer is based on historical documents."
        )
    if status == "historical":
        return (
            f"⚠️ Note: {prop['name']} is a historical property. "
            "Documents may be from a prior ownership period."
        )
    if status == "held":
        return (
            f"⚠️ Note: {prop['name']} is currently held (not actively managed). "
            "Information may not reflect current status."
        )
    if prop.get("is_external"):
        return (
            "⚠️ Note: This data is from external rent roll sources, "
            "not Woodcrest internal documents. Use for reference only."
        )
    return None