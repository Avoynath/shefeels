import React from 'react';
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import type { SvgIconProps } from '@mui/material';
import { 
  TrendingUp as TrendingUpIcon, 
  TrendingDown as TrendingDownIcon 
} from '@mui/icons-material';

interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  icon?: React.ComponentType<SvgIconProps>;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  trend,
  subtitle,
  icon: Icon
}) => {
  return (
    <Card sx={{ height: '100%', position: 'relative' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            {title}
          </Typography>
          {Icon && (
            <Icon sx={{ color: 'primary.main', fontSize: 20 }} />
          )}
        </Box>
        
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
          {value}
        </Typography>
        
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {subtitle}
          </Typography>
        )}
        
        {trend && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              size="small"
              icon={trend.isPositive ? <TrendingUpIcon /> : <TrendingDownIcon />}
              label={`${trend.isPositive ? '+' : '-'}${Math.abs(trend.value)}%`}
              color={trend.isPositive ? 'success' : 'error'}
              variant="outlined"
              sx={{ 
                fontSize: '0.75rem',
                height: 24,
                '& .MuiChip-icon': {
                  fontSize: 14
                }
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              vs last period
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
