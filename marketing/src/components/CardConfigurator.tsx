import { useState } from "react";
import { Slider } from "@/components/ui/slider";

const DENOMINATIONS = [25, 50, 100, 150, 200, 250, 500];
const SPLIT_OPTIONS = [10, 20, 25, 50, 100];

export function CardConfigurator() {
  const [amount, setAmount] = useState<number>(100);
  const [split, setSplit] = useState<number>(50);
  const [currentAge, setCurrentAge] = useState<number>(0);

  const investmentAmount = (amount * split) / 100;
  const spendableAmount = amount - investmentAmount;
  const projectedAt18 = investmentAmount * Math.pow(1.08, Math.max(0, 18 - currentAge));
  const projectedAt65 = projectedAt18 * Math.pow(1.08, 47); // 65 - 18 = 47 more years
  const totalGiftValue = spendableAmount + projectedAt18;

  const fmt = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
  const fmtCents = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center bg-primary text-white p-8 md:p-12 rounded-none border border-accent/20 shadow-2xl">
      <div className="space-y-10 order-2 lg:order-1">
        <div>
          <h3 className="text-xl font-serif font-bold mb-4 text-accent">1. Select Gift Amount</h3>
          <div className="flex flex-wrap gap-3">
            {DENOMINATIONS.map((val) => (
              <button
                key={val}
                onClick={() => setAmount(val)}
                className={`text-lg font-semibold py-3 px-5 transition-colors border ${
                  amount === val
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-transparent text-white border-white/20 hover:border-accent"
                }`}
              >
                ${val}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-serif font-bold mb-4 text-accent">2. Trump Account Split</h3>
          <div className="flex flex-wrap gap-3">
            {SPLIT_OPTIONS.map((val) => (
              <button
                key={val}
                onClick={() => setSplit(val)}
                className={`text-lg font-semibold py-3 px-5 transition-colors border ${
                  split === val
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-transparent text-white border-white/20 hover:border-accent"
                }`}
              >
                {val}%
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-xl font-serif font-bold text-accent">3. Child's Current Age</h3>
            <span className="text-lg font-medium text-white">
              {currentAge === 0 ? "Newborn" : `${currentAge} years old`}
            </span>
          </div>
          <Slider
            value={[currentAge]}
            onValueChange={(vals) => setCurrentAge(vals[0])}
            min={0}
            max={17}
            step={1}
            className="mb-2"
          />
          <div className="flex justify-between text-xs text-white/50">
            <span>Newborn</span>
            <span>Age 17</span>
          </div>
        </div>

        <div className="bg-[#060D18] p-6 border border-accent/20 mt-6">
          <p className="text-lg font-serif leading-relaxed text-white">
            Your <span className="font-bold text-accent">${amount}</span> gift gives them <span className="font-bold">{fmtCents(spendableAmount)}</span> to spend today and an estimated <span className="font-bold text-accent text-2xl block mt-2">{fmt(projectedAt18)}</span> in their Trump Account by age 18!
          </p>
        </div>
        
        <p className="text-xs text-white/40 leading-relaxed">
          Projections assume 8% average annual return based on historical U.S. stock market performance. Actual results will vary. Trump Account investments are in U.S. equity index funds.
        </p>
      </div>

      <div className="order-1 lg:order-2 flex flex-col items-center gap-6">

        {/* Total gift value — BIG */}
        <div className="w-full max-w-[400px] text-center border border-accent/30 bg-[#060D18] p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-accent/70 font-semibold mb-1">True Gift Value</div>
          <div className="text-xs text-white/50 mb-3">Cash to spend + Trump Account by age 18</div>
          <div className="text-6xl md:text-7xl font-serif font-bold text-accent leading-none transition-all duration-300">
            {fmt(totalGiftValue)}
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 text-sm text-white/60">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-white/60 inline-block" />
              {fmtCents(spendableAmount)} spendable
            </span>
            <span className="text-white/30">+</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent inline-block" />
              {fmt(projectedAt18)} by age 18
            </span>
          </div>
        </div>

        {/* Retirement value — prominent but secondary */}
        <div className="w-full max-w-[400px] text-center border border-white/10 bg-white/5 px-6 py-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50 font-semibold mb-1">If Kept to Retirement (Age 65)</div>
          <div className="text-3xl md:text-4xl font-serif font-semibold text-white/90 leading-none transition-all duration-300">
            {fmt(projectedAt65)}
          </div>
          <div className="text-xs text-white/35 mt-2">Assumes 8% avg annual return · for illustration only</div>
        </div>

        <div className="relative w-full max-w-[400px] aspect-[1.586/1] shadow-2xl overflow-hidden transition-transform duration-500 hover:scale-[1.02]">
          {/* Card Base */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#060D18] to-primary" />
          
          {/* Decorative Pattern */}
          <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==')]" />
          
          {/* Gold Accents */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent/30 to-transparent rounded-bl-full opacity-60" />
          
          {/* Card Content */}
          <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-between text-white">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 border-2 border-accent flex items-center justify-center font-serif font-bold text-xl text-accent bg-primary/50">
                  T
                </div>
                <div className="leading-tight">
                  <div className="font-serif font-bold text-base tracking-wider text-white uppercase">Trump Account</div>
                  <div className="text-xs text-accent tracking-widest font-medium uppercase mt-0.5">Gift Card</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-serif font-bold text-white">${amount}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex gap-1 h-3 bg-white/10 p-0.5">
                <div 
                  className="h-full bg-accent transition-all duration-500 ease-out" 
                  style={{ width: `${split}%` }}
                />
                <div 
                  className="h-full bg-white/80 transition-all duration-500 ease-out"
                  style={{ width: `${100 - split}%` }}
                />
              </div>
              
              <div className="flex justify-between text-sm font-sans">
                <div>
                  <div className="text-accent text-xs uppercase tracking-wider font-semibold mb-1">Invested</div>
                  <div className="font-semibold text-lg">${investmentAmount.toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-white/70 text-xs uppercase tracking-wider font-semibold mb-1">Spendable</div>
                  <div className="font-semibold text-lg">${spendableAmount.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}