import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Calendar, BarChart3, Clock } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Welcome to Election Cycle App</h2>
        <p className="text-muted-foreground">
          Analyze election cycle seasonal patterns in stock and crypto prices
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Market Symbols
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">108+</div>
            <p className="text-xs text-muted-foreground">
              Stocks and crypto supported
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Historical Data
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1971-Now</div>
            <p className="text-xs text-muted-foreground">
              Comprehensive data coverage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Election Cycles
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4 Phases</div>
            <p className="text-xs text-muted-foreground">
              Pre, Election, Mid, Post
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Analysis Type
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Hirsch</div>
            <p className="text-xs text-muted-foreground">
              Seasonal profile method
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>
              Everything you need to analyze seasonal patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              <li className="flex items-start gap-2">
                <div className="mt-1 rounded-full bg-primary/10 p-1">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                </div>
                <span className="text-sm">Hirsch-style seasonal profile analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 rounded-full bg-primary/10 p-1">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                </div>
                <span className="text-sm">Election cycle overlays (Pre-Election, Election, Mid-Term, Post-Election)</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 rounded-full bg-primary/10 p-1">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                </div>
                <span className="text-sm">Support for 100+ stocks and crypto symbols</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 rounded-full bg-primary/10 p-1">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                </div>
                <span className="text-sm">Linear and logarithmic scale views</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 rounded-full bg-primary/10 p-1">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                </div>
                <span className="text-sm">Real-time data from Yahoo Finance</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              Start analyzing seasonal patterns in seconds
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Navigate to the <strong>Election Cycle</strong> page from the sidebar to start analyzing seasonal patterns.
            </p>
            <Button asChild className="w-full">
              <Link href="/election-cycle">
                Go to Election Cycle Chart
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
        <CardHeader>
          <CardTitle className="text-amber-900 dark:text-amber-100">Disclaimer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This tool is for educational and research purposes only. Historical seasonal patterns do not guarantee future results. Always conduct thorough research and consult with financial advisors before making investment decisions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
