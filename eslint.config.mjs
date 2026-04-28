import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default [
  ...nextCoreWebVitals,
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "warn",
      // React 19 / React Compiler 严格规则。多数命中合法 React 18 写法。
      // 暂时降为 warning 让 CI 不被存量代码阻塞；新增/修改代码逐个改正后再升回 error。
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
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
