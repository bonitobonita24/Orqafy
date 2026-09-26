import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LoginErrorAlert } from "../login-error-alert";
import { GENERIC_LOGIN_ERROR, LOGIN_ERROR_MESSAGES } from "../login-error-messages";

const render = (code: string | string[] | undefined) =>
  renderToStaticMarkup(createElement(LoginErrorAlert, { code }));

describe("LoginErrorAlert (ORQ-39)", () => {
  it("renders nothing without an error code", () => {
    expect(render(undefined)).toBe("");
  });

  it.each(["tenant_suspended", "session_expired"])("renders a role=alert banner for %s", (code) => {
    const html = render(code);
    expect(html).toContain('role="alert"');
    expect(html).toContain(LOGIN_ERROR_MESSAGES[code]?.replace("'", "&#x27;"));
  });

  it("renders the generic message for an unknown code and never echoes the raw param", () => {
    const html = render('"><img src=x onerror=alert(1)>');
    expect(html).toContain(GENERIC_LOGIN_ERROR);
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<img");
  });
});
