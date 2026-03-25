import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Container,
  Avatar
} from '@mui/material';
import { People } from '@mui/icons-material';

// StatCard Component matching the design
interface StatCardProps {
  title: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value }) => (
  <Card sx={{ borderRadius: 3, boxShadow: 1 }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold" color="text.primary">
            {value}
          </Typography>
        </Box>
        <Avatar sx={{ bgcolor: '#fed7aa', color: '#ea580c', width: 56, height: 56 }}>
          <People sx={{ fontSize: 32 }} />
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

const DashboardPage: React.FC = () => {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Stats Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' }, gap: 3 }}>
          <StatCard title="Total Users" value="2000" />
          <StatCard title="Weekly Users" value="500" />
          <StatCard title="Monthly Users" value="500" />
          <StatCard title="Yearly Users" value="1000" />
        </Box>

        {/* Additional Content Area */}
        <Card sx={{ borderRadius: 3, boxShadow: 1 }}>
          <CardContent>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              Dashboard Overview
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Welcome to the admin dashboard. Use the navigation menu to access different sections.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default DashboardPage;
