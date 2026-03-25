import React from 'react';
import { Card, CardHeader, CardContent, Typography, useTheme } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LineChartCardProps {
  title: string;
  data: Array<{ [key: string]: string | number }>;
  lines: Array<{
    dataKey: string;
    stroke?: string;
    name?: string;
  }>;
  height?: number;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number | undefined, name: string | undefined) => [string, string];
}

export const LineChartCard: React.FC<LineChartCardProps> = ({
  title,
  data,
  lines,
  height = 300,
  formatYAxis,
  formatTooltip
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
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.grey[300]} />
              <XAxis
                dataKey="date"
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
              {lines.map((line) => (
                <Line
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  stroke={line.stroke || theme.palette.primary.main}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name={line.name || line.dataKey}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
