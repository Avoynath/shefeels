import React from 'react';
import { Card, CardHeader, CardContent, Typography, useTheme } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface DonutChartCardProps {
  title: string;
  data: Array<{ name: string; value: number; }>;
  height?: number;
  colors?: string[];
  formatTooltip?: (value: number | undefined, name: string | undefined) => [string, string];
}

export const DonutChartCard: React.FC<DonutChartCardProps> = ({
  title,
  data,
  height = 300,
  colors,
  formatTooltip
}) => {
  const theme = useTheme();

  const defaultColors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.error.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.success.main,
  ];

  const chartColors = colors || defaultColors;

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
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={chartColors[index % chartColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.grey[300]}`,
                  borderRadius: theme.shape.borderRadius,
                }}
                formatter={formatTooltip}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
