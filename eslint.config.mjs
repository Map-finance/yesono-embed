import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default [
  ...nextCoreWebVitals,
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "warn",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name='NEXT_PUBLIC_AUTH_API_URL']",
          message:
            "Do not access NEXT_PUBLIC_AUTH_API_URL directly in business code. Use lib/config/authApiUrl helpers instead.",
        },
      ],
    },
  },
  {
    files: ["lib/config/authApiUrl.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".vercel/**",
      ".wrangler/**",
      "node_modules/**",
      "out/**",
      "public/**",
    ],
  },
];
