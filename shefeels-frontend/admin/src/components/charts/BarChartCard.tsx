import React from 'react';
import { Card, CardHeader, CardContent, Typography, useTheme } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BarChartCardProps {
  title: string;
  data: Array<{ [key: string]: string | number }>;
  bars: Array<{
    dataKey: string;
    fill?: string;
    name?: string;
  }>;
  height?: number;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number | undefined, name: string | undefined) => [string, string];
  stacked?: boolean;
}

export const BarChartCard: React.FC<BarChartCardProps> = ({
  title,
  data,
  bars,
  height = 300,
  formatYAxis,
  formatTooltip,
  stacked = false
}) => {
  const theme = useTheme();

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title={<Typography variant="h6" fontWeight={600}>{title}</Typography>}
        sx={{ pb: 1 }}
      />
      <CardContent sx={{ pt: 0, height: height }}>
        {data.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
            No data available
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.grey[300]} />
              <XAxis
                dataKey="name"
                stroke={theme.palette.text.secondary}
                fontSize={12}
              />
              <YAxis
                stroke={theme.palette.text.secondary}
                fontSize={12}
                tickFormatter={formatYAxis}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.grey[300]}`,
                  borderRadius: theme.shape.borderRadius,
                }}
                formatter={formatTooltip}
              />
              <Legend />
              {bars.map((bar) => (
                <Bar
                  key={bar.dataKey}
                  dataKey={bar.dataKey}
                  fill={bar.fill || theme.palette.primary.main}
                  name={bar.name || bar.dataKey}
                  stackId={stacked ? 'stack' : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
