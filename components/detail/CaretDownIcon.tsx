import React from "react";

/** 小尺寸的向下箭头图标，用于 TimeCapsule 等下拉按钮。 */
const CaretDownIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12px"
    height="12px"
    viewBox="0 0 12 12"
    className="text-(--text-primary) transition-transform duration-200"
  >
    <polyline
      points="1.75 4.25 6 8.5 10.25 4.25"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

export default CaretDownIcon;
