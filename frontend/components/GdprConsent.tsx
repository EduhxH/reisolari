"use client";

import React from "react";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const GdprConsent: React.FC<Props> = ({ checked, onChange }) => {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-black/10 bg-white p-4 text-sm text-supaste-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="mt-1"
      />
      <span>
        Autorizo o tratamento das coordenadas do telhado e dos dados tecnicos da simulacao para calcular
        potencial fotovoltaico e guardar o resultado.
      </span>
    </label>
  );
};

export default GdprConsent;
