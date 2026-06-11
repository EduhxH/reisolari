from pydantic import BaseModel


class PhysicsInput(BaseModel):
    area_m2: float
    panel_efficiency: float  # 0.205
    irradiation_kwh_m2_year: float  # H
    performance_ratio: float  # 0.75


class PhysicsResult(BaseModel):
    annual_energy_kwh: float


def compute_annual_energy(input: PhysicsInput) -> PhysicsResult:
    """
    E = A * r * H * PR

    A: área do telhado em m²
    r: eficiência do painel (fração, ex: 0.205 para 20.5%)
    H: irradiação anual global em kWh/m²/ano (PVGIS)
    PR: performance ratio (fração, ex: 0.75)

    O resultado E é a energia elétrica anual produzida em kWh/ano.
    """
    E = input.area_m2 * input.panel_efficiency * input.irradiation_kwh_m2_year * input.performance_ratio
    return PhysicsResult(annual_energy_kwh=E)
