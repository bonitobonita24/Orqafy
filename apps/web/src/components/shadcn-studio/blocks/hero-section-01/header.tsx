import { MenuIcon } from '@/components/ui/icons'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList
} from '@/components/ui/navigation-menu'

import { cn } from '@/lib/utils'

import Logo from '@/components/shadcn-studio/logo'

export type NavigationSection = {
  title: string
  href: string
}

type HeaderProps = {
  navigationData: NavigationSection[]
  className?: string
  /** Secondary (outline) CTA — e.g. "Sign in" */
  secondaryCtaLabel?: string
  secondaryCtaHref?: string
  /** Primary (filled) CTA — e.g. "Get started" */
  primaryCtaLabel?: string
  primaryCtaHref?: string
}

const Header = ({
  navigationData,
  className,
  secondaryCtaLabel,
  secondaryCtaHref = '#',
  primaryCtaLabel = 'Login',
  primaryCtaHref = '#'
}: HeaderProps) => {
  return (
    <header data-fdl='site-header' className={cn('bg-background sticky top-0 z-50 h-16 border-b', className)}>
      <div className='mx-auto flex h-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8'>
        {/* Logo */}
        <a href='/' aria-label='Orqafy home'>
          <Logo className='gap-3' />
        </a>

        {/* Navigation */}
        <NavigationMenu className='max-md:hidden' aria-label='Main navigation'>
          <NavigationMenuList className='flex-wrap justify-start gap-0'>
            {navigationData.map(navItem => (
              <NavigationMenuItem key={navItem.title}>
                <NavigationMenuLink
                  href={navItem.href}
                  className='text-muted-foreground hover:text-primary px-3 py-1.5 text-base! font-medium hover:bg-transparent'
                >
                  {navItem.title}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        {/* CTAs */}
        <div className='flex items-center gap-3 max-md:hidden'>
          {secondaryCtaLabel && (
            <Button variant='outline' className='rounded-lg' asChild>
              <a href={secondaryCtaHref}>{secondaryCtaLabel}</a>
            </Button>
          )}
          <Button className='rounded-lg' asChild>
            <a href={primaryCtaHref}>{primaryCtaLabel}</a>
          </Button>
        </div>

        {/* Navigation for small screens */}
        <div className='flex gap-4 md:hidden'>
          <Button className='rounded-lg' asChild>
            <a href={primaryCtaHref}>{primaryCtaLabel}</a>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' size='icon'>
                <MenuIcon />
                <span className='sr-only'>Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className='w-56' align='end'>
              {navigationData.map((item, index) => (
                <DropdownMenuItem key={index} asChild>
                  <a href={item.href}>{item.title}</a>
                </DropdownMenuItem>
              ))}
              {secondaryCtaLabel && (
                <DropdownMenuItem asChild>
                  <a href={secondaryCtaHref}>{secondaryCtaLabel}</a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

export default Header
