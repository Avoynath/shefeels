import React from 'react'
import { Download } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import { cn } from '../lib/utils'

interface SectionCardProps {
  title: string
  description?: string
  children?: React.ReactNode
  onExport?: () => void
  isLoading?: boolean
  error?: string | null
  className?: string
}

export function SectionCard({
  title,
  description,
  children,
  onExport,
  isLoading = false,
  error = null,
  className,
}: SectionCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          {description && (
            <CardDescription className="text-sm">{description}</CardDescription>
          )}
        </div>
        {onExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={isLoading}
          >
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p>Error: {error}</p>
          </div>
        ) : !children ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <p>No data for this range. Try expanding your date range.</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
