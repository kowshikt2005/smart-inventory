"use client";

interface MonthlyValue {
  month: number;
  year: number;
}

interface AnnualValue {
  fy: string;
}

interface MonthlyProps {
  mode: "monthly";
  value: MonthlyValue;
  onChange: (value: MonthlyValue) => void;
}

interface AnnualProps {
  mode: "annual";
  value: AnnualValue;
  onChange: (value: AnnualValue) => void;
}

type GSTMonthYearSelectorProps = MonthlyProps | AnnualProps;

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function generateYears(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y);
  }
  return years;
}

function generateFYs(): string[] {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  // If we're in Jan-Mar, current FY started last year
  const currentFYStart = currentMonth < 3 ? currentYear - 1 : currentYear;
  const fys: string[] = [];
  for (let y = currentFYStart; y >= currentFYStart - 4; y--) {
    const endYearShort = String(y + 1).slice(-2);
    fys.push(`${y}-${endYearShort}`);
  }
  return fys;
}

export function GSTMonthYearSelector(props: GSTMonthYearSelectorProps) {
  if (props.mode === "monthly") {
    const { value, onChange } = props;
    return (
      <div className="flex items-center gap-3">
        <select
          value={value.month}
          onChange={(e) =>
            onChange({ ...value, month: parseInt(e.target.value) })
          }
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={value.year}
          onChange={(e) =>
            onChange({ ...value, year: parseInt(e.target.value) })
          }
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        >
          {generateYears().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Annual mode
  const { value, onChange } = props;
  return (
    <div className="flex items-center gap-3">
      <select
        value={value.fy}
        onChange={(e) => onChange({ fy: e.target.value })}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
      >
        {generateFYs().map((fy) => (
          <option key={fy} value={fy}>
            FY {fy}
          </option>
        ))}
      </select>
    </div>
  );
}

export function getDefaultMonthly(): MonthlyValue {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function getDefaultAnnual(): AnnualValue {
  const now = new Date();
  const currentFYStart = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const endYearShort = String(currentFYStart + 1).slice(-2);
  return { fy: `${currentFYStart}-${endYearShort}` };
}
