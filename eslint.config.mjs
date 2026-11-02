import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  // Ignore non-app directories and scripts
  {
    ignores: [
      "demo/**",
      ".next/**",
      "skills/**",
      "docs/**",
      "scripts/**",
      ".agents/**",
      ".pi/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
