"use client";

import React from "react";

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
};

const GdprConsent: React.FC<Props> = ({ checked, onChange }) => {
  return (
    <label className="flex items-start gap-2 text-xs text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-1"
      />
      <span>
        Autorizo o armazenamento do meu endereço IP e das coordenadas do telhado para efeitos de
        simulação e estudo, em conformidade com o RGPD.
      </span>
    </label>
  );
};

export default GdprConsent;
