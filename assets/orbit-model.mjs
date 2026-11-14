const turn = 2 * Math.PI;
const gravitationalRadiusPerSolarMassAU = 1.476625 / 149597870.7;

export const periodYears = 16.046;
export const eccentricity = 0.884;
export const blackHoleMassSolar = 4.30e6;
export const semiMajorAxisAU = Math.cbrt(blackHoleMassSolar * periodYears ** 2);
export const totalYears = 2 * periodYears;
export const visualMagnification = 60;

const advanceRadians =
  6 * Math.PI * gravitationalRadiusPerSolarMassAU * blackHoleMassSolar
  / (semiMajorAxisAU * (1 - eccentricity ** 2));

export const advanceArcminutes = advanceRadians * (180 * 60 / Math.PI);

function eccentricAnomaly(meanAnomaly) {
  let anomaly = Math.PI;
  for (let iteration = 0; iteration < 16; iteration += 1) {
    const residual = anomaly - eccentricity * Math.sin(anomaly) - meanAnomaly;
    const correction = residual / (1 - eccentricity * Math.cos(anomaly));
    anomaly -= correction;
    if (Math.abs(correction) < 1e-13) break;
  }
  return anomaly;
}

export function positionAt(timeYears, magnification = 0) {
  const revolutions = timeYears / periodYears;
  const completed = Math.floor(revolutions);
  const meanAnomaly = (revolutions - completed) * turn;
  const anomaly = eccentricAnomaly(meanAnomaly);
  const x = semiMajorAxisAU * (Math.cos(anomaly) - eccentricity);
  const y = semiMajorAxisAU * Math.sqrt(1 - eccentricity ** 2) * Math.sin(anomaly);
  const distance = Math.hypot(x, y);
  let angle = Math.atan2(y, x);
  if (angle < 0 && meanAnomaly > Math.PI) angle += turn;
  const rotation = magnification * advanceRadians * (completed + angle / turn);

  return {
    x: distance * Math.cos(angle + rotation),
    y: distance * Math.sin(angle + rotation),
    distance,
  };
}

export function trace(magnification, count = 960) {
  return Array.from({ length: count + 1 }, (_, index) =>
    positionAt(totalYears * index / count, magnification),
  );
}
