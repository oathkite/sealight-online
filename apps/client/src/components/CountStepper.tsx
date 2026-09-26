import type { ReactNode } from "react";

type CountStepperProps = {
  /** 「食料」「ポーション」のような名前。ボタンの名前にも使う */
  readonly name: string;
  readonly unit: string;
  readonly icon: ReactNode;
  readonly value: number;
  readonly max: number;
  /** 家にある数。これを超えた分は、薄く表して足りないと分かるようにする */
  readonly stock: number;
  readonly disabled: boolean;
  readonly onChange: (value: number) => void;
};

/** 持たせる数を選ぶ。選んだ数だけ絵が灯り、家に足りない分は欠けて見える */
export const CountStepper = ({ name, unit, icon, value, max, stock, disabled, onChange }: CountStepperProps) => (
  <div className="stepper" role="group" aria-label={`持たせる${name}`}>
    <button type="button" aria-label={`${name}を減らす`} disabled={disabled || value <= 0} onClick={() => onChange(value - 1)}>
      −
    </button>
    <span className="stepper-value">
      <span className="breads" aria-hidden="true">
        {Array.from({ length: value }, (_, i) => (
          <span key={i} className={i < stock ? "bread on" : "bread missing"}>
            {icon}
          </span>
        ))}
      </span>
      <span className="stepper-count">
        {value} {unit}
      </span>
    </span>
    <button type="button" aria-label={`${name}を増やす`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
      ＋
    </button>
  </div>
);
