"""
Government incentives for rooftop rainwater harvesting in India.

Amounts are indicative and change over time; every entry carries a portal to
verify against and is shown with a disclaimer. Only schemes with a direct
capital grant to the property owner reduce the indicative net project cost.
"""
from typing import Any, Dict, List, Optional

DISCLAIMER = (
    "Subsidy amounts are indicative estimates compiled from published scheme information. "
    "They are subject to official verification, the scheme's current guidelines, budget availability "
    "and formal approval by the issuing authority, and are not a guaranteed reduction in cost. "
    "Confirm eligibility and the current rate with the authority before you commit to any expense."
)

# Matched against the reverse-geocoded state name
STATE_ALIASES = {
    "delhi": "DL", "nct of delhi": "DL", "national capital territory of delhi": "DL",
    "madhya pradesh": "MP", "maharashtra": "MH", "tamil nadu": "TN", "karnataka": "KA",
    "kerala": "KL", "rajasthan": "RJ", "gujarat": "GJ", "haryana": "HR", "uttar pradesh": "UP",
    "telangana": "TG", "andhra pradesh": "AP", "punjab": "PB", "west bengal": "WB", "odisha": "OD",
}

CENTRAL_SCHEMES: List[Dict[str, Any]] = [
    {
        "id": "mgnrega",
        "name": "MGNREGA - individual recharge / soak pits",
        "authority": "Ministry of Rural Development (Central)",
        "level": "Central",
        "assistance": "Construction of recharge pits on private land executed under the scheme (wage and material cost borne by MGNREGA)",
        "eligibility": "Rural households with a job card in priority categories (SC/ST, BPL, small and marginal farmers, PMAY-G beneficiaries, etc.). Not available in municipal areas.",
        "how_to_apply": "Apply through your Gram Panchayat for inclusion of the work in the annual shelf of projects.",
        "portal": "https://nrega.nic.in",
        "grant_rate": None,
        "grant_cap": None,
        "applies_to": "rural",
    },
    {
        "id": "jsa-ctr",
        "name": "Jal Shakti Abhiyan: Catch the Rain",
        "authority": "Ministry of Jal Shakti (Central)",
        "level": "Central",
        "assistance": "No direct household grant; technical guidance and convergence funding for RWH structures through districts and urban local bodies.",
        "eligibility": "All citizens; district Jal Shakti Kendras provide design support.",
        "how_to_apply": "Contact your district Jal Shakti Kendra or urban local body.",
        "portal": "https://jsactr.mowr.gov.in",
        "grant_rate": None,
        "grant_cap": None,
        "applies_to": "all",
    },
    {
        "id": "amrut2",
        "name": "AMRUT 2.0",
        "authority": "Ministry of Housing and Urban Affairs (Central)",
        "level": "Central",
        "assistance": "Funds city water-security and recharge projects via urban local bodies; no direct grant to individual homeowners.",
        "eligibility": "Implemented by municipal bodies in AMRUT cities.",
        "how_to_apply": "Check whether your municipality runs a household RWH component funded under AMRUT 2.0.",
        "portal": "https://amrut.mohua.gov.in",
        "grant_rate": None,
        "grant_cap": None,
        "applies_to": "urban",
    },
    {
        "id": "jjm",
        "name": "Jal Jeevan Mission (source sustainability)",
        "authority": "Ministry of Jal Shakti (Central)",
        "level": "Central",
        "assistance": "Supports village-level greywater management and source-recharge works; no individual cash subsidy.",
        "eligibility": "Rural villages through the Village Water and Sanitation Committee (VWSC).",
        "how_to_apply": "Raise the proposal in the Village Action Plan through your Gram Panchayat / VWSC.",
        "portal": "https://jaljeevanmission.gov.in",
        "grant_rate": None,
        "grant_cap": None,
        "applies_to": "rural",
    },
]

STATE_SCHEMES: Dict[str, List[Dict[str, Any]]] = {
    "DL": [{
        "id": "djb-rwh",
        "name": "Delhi Jal Board RWH financial assistance",
        "authority": "Delhi Jal Board, Govt. of NCT of Delhi (State)",
        "level": "State",
        "assistance": "50% of installation cost up to ₹50,000, plus a 10% rebate on water bills while the system is functional",
        "eligibility": "Registered DJB consumers who install a functional rooftop RWH system (mandatory for plots of 100 m² and above).",
        "how_to_apply": "Apply online on the DJB portal or at your DJB zonal office with photographs and the installation bill.",
        "portal": "https://djb.gov.in",
        "grant_rate": 0.5,
        "grant_cap": 50000,
        "bill_rebate": 0.10,
        "applies_to": "urban",
    }],
    "MP": [{
        "id": "mp-property-tax",
        "name": "Municipal property-tax rebate for RWH",
        "authority": "Municipal Corporations of Madhya Pradesh, e.g. Indore (State / ULB)",
        "level": "State",
        "assistance": "Property-tax rebate (published at 6% in Indore) for the year the RWH system is completed",
        "eligibility": "Property owners in participating municipal corporations who install a working RWH system.",
        "how_to_apply": "Submit completion proof with the property-tax return to your municipal corporation.",
        "portal": "https://www.mpenagarpalika.gov.in",
        "grant_rate": None,
        "grant_cap": None,
        "applies_to": "urban",
    }],
    "MH": [{
        "id": "mh-property-tax",
        "name": "Eco-housing property-tax rebate",
        "authority": "Municipal Corporations of Maharashtra, e.g. Pune, Thane (State / ULB)",
        "level": "State",
        "assistance": "Property-tax rebate for RWH and other green features in select corporations (rates vary by city)",
        "eligibility": "Residential properties with certified RWH in participating corporations.",
        "how_to_apply": "Apply to the property-tax department of your municipal corporation with a completion certificate.",
        "portal": "https://www.pmc.gov.in",
        "grant_rate": None,
        "grant_cap": None,
        "applies_to": "urban",
    }],
    "TN": [{
        "id": "tn-mandate",
        "name": "Tamil Nadu mandatory RWH (TN Municipal Laws)",
        "authority": "Municipal Administration & Water Supply Dept., Tamil Nadu (State)",
        "level": "State",
        "assistance": "No cash subsidy; RWH is mandatory for all buildings and free design guidance is offered by Metro Water / ULBs",
        "eligibility": "All buildings; non-compliance can attract disconnection of water/sewer service.",
        "how_to_apply": "Contact Chennai Metro Water's RWH cell or your municipality for a free site inspection.",
        "portal": "https://chennaimetrowater.tn.gov.in",
        "grant_rate": None,
        "grant_cap": None,
        "applies_to": "urban",
    }],
    "KA": [{
        "id": "ka-bwssb",
        "name": "BWSSB RWH compliance (Bengaluru)",
        "authority": "Bangalore Water Supply and Sewerage Board (State)",
        "level": "State",
        "assistance": "No cash subsidy; avoids the monthly penalty levied on non-compliant properties and offers free technical help at the RWH Theme Park",
        "eligibility": "Mandatory for specified plot sizes within BWSSB limits.",
        "how_to_apply": "Upload RWH proof on the BWSSB portal to stop non-compliance charges.",
        "portal": "https://bwssb.karnataka.gov.in",
        "grant_rate": None,
        "grant_cap": None,
        "applies_to": "urban",
    }],
}

LOCAL_BODY_FALLBACK = {
    "id": "ulb",
    "name": "Your municipal corporation / panchayat",
    "authority": "Urban or rural local body (Local)",
    "level": "Local",
    "assistance": "Many local bodies offer property-tax or water-charge concessions for working RWH systems; rates differ by city",
    "eligibility": "Set by the local body's building bye-laws.",
    "how_to_apply": "Ask the property-tax or water-supply department whether an RWH concession applies at your address.",
    "portal": "https://www.india.gov.in",
    "grant_rate": None,
    "grant_cap": None,
    "applies_to": "all",
}


def state_code(state: Optional[str]) -> Optional[str]:
    if not state:
        return None
    key = state.strip().lower()
    if key.upper() in {code for code in STATE_ALIASES.values()}:
        return key.upper()
    return STATE_ALIASES.get(key)


def find_subsidies(state: Optional[str], total_cost: float, water_tariff: float, annual_supply_m3: float,
                   recharge_cost: float = 0.0) -> Dict[str, Any]:
    """
    Schemes for the state, each with an indicative amount it could take off
    the project cost. Only open-to-all percentage grants are applied
    automatically; schemes with eligibility conditions (e.g. MGNREGA, rural job
    card holders only) are offered for the user to select.
    """
    code = state_code(state)
    schemes = [dict(s) for s in STATE_SCHEMES.get(code or "", [])] + [dict(LOCAL_BODY_FALLBACK)] + [dict(s) for s in CENTRAL_SCHEMES]

    best_grant, best_scheme = 0.0, None
    for scheme in schemes:
        grant = 0.0
        if scheme.get("grant_rate") and total_cost > 0:
            grant = total_cost * scheme["grant_rate"]
            if scheme.get("grant_cap"):
                grant = min(grant, scheme["grant_cap"])
        auto_apply = grant > 0
        if scheme["id"] == "mgnrega" and recharge_cost > 0:
            # MGNREGA bears the wage and material cost of the recharge structure
            grant = min(recharge_cost, total_cost)
            auto_apply = False
        scheme["indicative_grant"] = round(grant, 2)
        scheme["deductible"] = grant > 0
        if scheme.get("bill_rebate"):
            # Rebate on the water bill for the water still bought from the utility
            scheme["indicative_annual_rebate_note"] = f"{int(scheme['bill_rebate'] * 100)}% off your water bill each year"
        if auto_apply and grant > best_grant:
            best_grant, best_scheme = grant, scheme["id"]

    # Highest indicative help first; ties keep state before local before central
    schemes.sort(key=lambda s: -s.get("indicative_grant", 0))

    return {
        "state": state or "",
        "state_code": code,
        "schemes": schemes,
        "applied_scheme": best_scheme,
        "indicative_subsidy": round(best_grant, 2),
        "gross_cost": round(total_cost, 2),
        "indicative_net_cost": round(max(0.0, total_cost - best_grant), 2),
        "disclaimer": DISCLAIMER,
    }
