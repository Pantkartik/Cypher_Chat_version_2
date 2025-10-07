"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Shield, Zap, Users, Lock, QrCode, MessageSquare, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"

export default function LandingPage() {
  const { theme, setTheme } = useTheme()
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)

  const features = [
    {
      icon: Shield,
      title: "End-to-End Encryption",
      description: "Military-grade encryption ensures your conversations stay private and secure.",
      color: "text-accent",
    },
    {
      icon: QrCode,
      title: "QR Code Sharing",
      description: "Share chat sessions instantly with secure QR codes. No complex setup required.",
      color: "text-primary",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Real-time messaging with smooth animations and instant delivery.",
      color: "text-secondary",
    },
    {
      icon: Users,
      title: "Host & Join",
      description: "Create secure chat rooms or join existing ones with a simple token.",
      color: "text-accent",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-card">
      {/* Navigation */}
      <nav className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <Lock className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">SecureChat</span>
            </div>

            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="hover:bg-accent/10"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
              <Link href="/auth/login">
                <Button variant="ghost" className="hover:bg-accent/10">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge variant="secondary" className="mb-6 bg-accent/10 text-accent border-accent/20">
              <Zap className="w-3 h-3 mr-1" />
              Now with QR Code Sharing
            </Badge>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-balance mb-6">
              <span className="text-foreground">Secure Messaging</span>
              <br />
              <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                Made Simple
              </span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-pretty leading-relaxed">
              Experience the future of private communication with end-to-end encryption, instant QR code sharing, and a
              beautiful interface that just works.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground group">
                  Start Chatting Now
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="border-border hover:bg-accent/5 bg-transparent">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  View Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 text-balance">
              Everything you need for secure communication
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              Built with modern security standards and designed for seamless user experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-accent/5 border-border/50 hover:border-accent/30"
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <CardContent className="p-6">
                  <div
                    className={`w-12 h-12 rounded-lg bg-gradient-to-br from-${feature.color.split("-")[1]}/10 to-${feature.color.split("-")[1]}/20 flex items-center justify-center mb-4 transition-transform duration-300 ${hoveredFeature === index ? "scale-110" : ""}`}
                  >
                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Card className="border-border/50 bg-gradient-to-br from-card to-background">
            <CardContent className="p-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 text-balance">
                Ready to secure your conversations?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 text-pretty">
                Join thousands of users who trust SecureChat for their private communications.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth/signup">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Create Free Account
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button size="lg" variant="outline" className="border-border hover:bg-accent/5 bg-transparent">
                    Sign In
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 bg-card/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-6 h-6 bg-gradient-to-br from-primary to-accent rounded flex items-center justify-center">
                <Lock className="w-3 h-3 text-white" />
              </div>
              <span className="text-lg font-semibold text-foreground">SecureChat</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2024 SecureChat. Built with security and privacy in mind.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
