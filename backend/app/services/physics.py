from pydantic import BaseModel


class PhysicsInput(BaseModel):
    area_m2: float
    panel_efficiency: float
    irradiation_kwh_m2_year: float
    performance_ratio: float


class PhysicsResult(BaseModel):
    annual_energy_kwh: float


def compute_annual_energy(input: PhysicsInput) -> PhysicsResult:
    """
    E = A * r * H * PR

    A: roof area in square metres.
    r: photovoltaic module efficiency as a fraction, e.g. 0.205 for 20.5%.
    H: annual global irradiation in kWh/m2/year, derived from PVGIS.
    PR: performance ratio, as a fraction, for real installation losses.

    Scientific notes for the FQ report:
    - H is derived from the European Commission PVGIS output for the selected
      coordinates. PVGIS is the external reference for location-specific solar
      irradiation.
    - r represents module conversion efficiency under standard test conditions.
      A value around 20-21% is typical for modern monocrystalline modules.
    - PR aggregates real-system losses: inverter conversion, wiring, soiling,
      mismatch, temperature losses and availability. A 0.75 default is deliberately
      conservative for an educational simulation.
    """
    energy = (
        input.area_m2
        * input.panel_efficiency
        * input.irradiation_kwh_m2_year
        * input.performance_ratio
    )
    return PhysicsResult(annual_energy_kwh=energy)
