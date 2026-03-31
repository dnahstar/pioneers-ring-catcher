"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

const ChartContext = React.createContext<{ config: any } | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a ChartContainer.")
  }
  return context
}

const Chart = RechartsPrimitive.ResponsiveContainer

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> & {
    hideLabel?: boolean
  }
>(({ hideLabel = false, payload }, ref) => {
  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel) {
      return null
    }
    return null
  }, [hideLabel])

  return null
})
ChartTooltipContent.displayName = "ChartTooltip"

const ChartLegend = RechartsPrimitive.Legend
const ChartLegendContent = React.forwardRef<any, any>((props, ref) => null)
ChartLegendContent.displayName = "ChartLegend"

const ChartStyle = ({ id, config }: { id: string; config: any }) => null

export {
  Chart,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
