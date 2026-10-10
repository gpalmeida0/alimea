import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    // React Compiler rules added by eslint-plugin-react-hooks v6. The existing
    // code predates them; keep them visible as warnings until it is migrated.
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"] },
];

export default config;
