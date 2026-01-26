"use client"

import * as React from "react"
import { memo, useCallback } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function ModeToggleComponent() {
  const { setTheme } = useTheme()

  // Memoize theme change handlers to prevent unnecessary re-renders
  const handleLightTheme = useCallback(() => {
    setTheme("light")
  }, [setTheme])

  const handleDarkTheme = useCallback(() => {
    setTheme("dark")
  }, [setTheme])

  const handleSystemTheme = useCallback(() => {
    setTheme("system")
  }, [setTheme])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[100]">
        <DropdownMenuItem onClick={handleLightTheme}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDarkTheme}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSystemTheme}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const ModeToggle = memo(ModeToggleComponent)
