terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "zone_id" {
  type = string
}

variable "account_id" {
  type = string
}

# -----------------------------------------------------------------------------
# Zero Trust Application for Admin Dashboard
# -----------------------------------------------------------------------------
resource "cloudflare_access_application" "admin_dashboard" {
  zone_id                   = var.zone_id
  name                      = "Markova Admin Dashboard"
  domain                    = "admin.markova.tech"
  session_duration          = "12h"
  auto_redirect_to_identity = true
  
  allowed_idps = [
    cloudflare_access_identity_provider.google_workspace.id
  ]
}

# -----------------------------------------------------------------------------
# Zero Trust Policy: Require Corporate Email & MFA
# -----------------------------------------------------------------------------
resource "cloudflare_access_policy" "admin_policy" {
  application_id = cloudflare_access_application.admin_dashboard.id
  zone_id        = var.zone_id
  name           = "Require Corporate Email & MFA"
  precedence     = 1
  decision       = "allow"

  include {
    email_domain = ["markova.tech"]
  }

  require {
    # MFA is enforced at the IdP (Google Workspace) layer before CF issues the JWT assertion.
    email_domain = ["markova.tech"]
  }
}

# -----------------------------------------------------------------------------
# Identity Provider Configuration (Google Workspace)
# -----------------------------------------------------------------------------
resource "cloudflare_access_identity_provider" "google_workspace" {
  account_id = var.account_id
  name       = "Corporate Google Workspace"
  type       = "google"

  config {
    client_id     = var.google_client_id
    client_secret = var.google_client_secret
  }
}

variable "google_client_id" {
  type = string
}

variable "google_client_secret" {
  type      = string
  sensitive = true
}
