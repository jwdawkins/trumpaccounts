import { useState, useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Label } from "@/components/ui/label";

const fmt = (val: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);

export function GrowthCalculator() {
  const [annualGift, setAnnualGift] = useState<number>(500);
  const [split, setSplit] = useState<number>(100);
  const [currentAge, setCurrentAge] = useState<number>(0);
  const [rateOfReturn, setRateOfReturn] = useState<number>(8);

  const data = useMemo(() => {
    const annualInvestment = (annualGift * split) / 100;
    const rate = rateOfReturn / 100;

    let currentBalance = 0;
    const points = [];

    for (let age = currentAge; age <= 65; age++) {
      if (age < 18) {
        currentBalance = (currentBalance + annualInvestment) * (1 + rate);
      } else {
        currentBalance = currentBalance * (1 + rate);
      }

      if (age === 18 || age === 30 || age === 50 || age === 65 || age % 5 === 0) {
        points.push({
          age,
          value: Math.round(currentBalance),
          formattedValue: fmt(currentBalance),
        });
      }
    }

    return points;
  }, [annualGift, split, currentAge, rateOfReturn]);

  const valueAt18 = data.find((d) => d.age === 18)?.value || 0;
  const valueAt30 = data.find((d) => d.age === 30)?.value || 0;
  const valueAt65 = data.find((d) => d.age === 65)?.value || 0;
  const annualContribution = Math.round((annualGift * split) / 100);

  return (
    <div className="bg-white border border-border shadow-xl overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {/* Controls panel */}
        <div className="p-8 lg:p-10 lg:border-r border-border bg-background">
          <div className="space-y-8">
            {/* Annual Gift */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="annualGift" className="text-base font-semibold text-primary font-serif tracking-wide">
                  Annual Gift Amount
                </Label>
                <span className="font-semibold text-primary text-lg">${annualGift}</span>
              </div>
              <input
                id="annualGift"
                type="range"
                min="25"
                max="5000"
                step="25"
                value={annualGift}
                onChange={(e) => setAnnualGift(Number(e.target.value))}
                className="w-full accent-primary h-2 cursor-pointer"
              />
            </div>

            {/* Split */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="split" className="text-base font-semibold text-primary font-serif tracking-wide">
                  Split to Trump Account
                </Label>
                <span className="font-semibold text-primary text-lg">{split}%</span>
              </div>
              <input
                id="split"
                type="range"
                min="10"
                max="100"
                step="5"
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
                className="w-full accent-primary h-2 cursor-pointer"
              />
            </div>

            {/* Child's Age */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="age" className="text-base font-semibold text-primary font-serif tracking-wide">
                  Child's Current Age
                </Label>
                <span className="font-semibold text-primary text-lg">
                  {currentAge === 0 ? "Newborn" : `${currentAge} yrs`}
                </span>
              </div>
              <input
                id="age"
                type="range"
                min="0"
                max="17"
                step="1"
                value={currentAge}
                onChange={(e) => setCurrentAge(Number(e.target.value))}
                className="w-full accent-primary h-2 cursor-pointer"
              />
            </div>

            {/* Rate of Return */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="rateOfReturn" className="text-base font-semibold text-primary font-serif tracking-wide">
                  Est. Annual Return
                </Label>
                <span className="font-semibold text-accent text-lg">{rateOfReturn}%</span>
              </div>
              <input
                id="rateOfReturn"
                type="range"
                min="3"
                max="15"
                step="0.5"
                value={rateOfReturn}
                onChange={(e) => setRateOfReturn(Number(e.target.value))}
                className="w-full accent-accent h-2 cursor-pointer"
              />
            </div>

            {/* Summary box */}
            <div className="bg-primary p-6 mt-6 border-l-4 border-accent">
              <p className="text-sm text-white/90 leading-relaxed font-sans">
                Investing <span className="font-bold text-white">{fmt(annualContribution)}/yr</span> at <span className="font-bold text-accent">{rateOfReturn}% return</span> could grow to:
              </p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-serif font-bold text-accent tracking-tight">{fmt(valueAt65)}</span>
                <span className="text-sm font-medium text-white/70">by age 65</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart panel */}
        <div className="p-8 lg:p-10 lg:col-span-2 flex flex-col bg-white">
          {/* Milestone cards */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="bg-background border border-border px-5 py-4 flex flex-col justify-center">
              <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Age 18</div>
              <div className="text-2xl font-serif font-bold text-primary">{fmt(valueAt18)}</div>
            </div>
            <div className="bg-background border border-border px-5 py-4 flex flex-col justify-center">
              <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">Age 30</div>
              <div className="text-2xl font-serif font-bold text-primary">{fmt(valueAt30)}</div>
            </div>
            <div className="bg-primary px-5 py-4 flex flex-col justify-center text-white border-b-4 border-accent">
              <div className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">Age 65</div>
              <div className="text-2xl font-serif font-bold">{fmt(valueAt65)}</div>
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="age"
                  tickFormatter={(v) => `${v}`}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--primary))", fontSize: 12, fontWeight: 500 }}
                  dy={10}
                  label={{ value: "Age", position: "insideBottomRight", offset: -5, fontSize: 12, fill: "hsl(var(--primary))", fontWeight: 600 }}
                />
                <YAxis
                  tickFormatter={(v) =>
                    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}k` : `$${v}`
                  }
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--primary))", fontSize: 12, fontWeight: 500 }}
                  dx={-6}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-primary text-white border border-accent shadow-xl p-4">
                          <p className="text-xs font-medium uppercase tracking-widest text-accent mb-2">Age {payload[0].payload.age}</p>
                          <p className="text-xl font-serif font-bold">{payload[0].payload.formattedValue}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--accent))"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}