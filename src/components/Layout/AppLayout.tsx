import { type ReactElement, useMemo } from "react";
import { Layout, Menu, Avatar, Button, Space } from "antd";
import {
  DashboardOutlined,
  FundOutlined,
  RobotOutlined,
  SettingOutlined,
  LogoutOutlined,
  LineChartOutlined,
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { useSalaryReminder } from "../../hooks/useSalaryReminder";
import styles from "./AppLayout.module.css";

const { Sider, Content } = Layout;

function AppLayout(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { shouldShowReminder, dismissReminder } = useSalaryReminder();

  const menuItems = useMemo(
    () => [
      {
        key: "/",
        icon: <DashboardOutlined />,
        label: t("nav.dashboard"),
      },
      {
        key: "/investments",
        icon: <FundOutlined />,
        label: t("nav.investments"),
      },
      {
        key: "/market",
        icon: <LineChartOutlined />,
        label: t("nav.market"),
      },
      {
        key: "/chat",
        icon: <RobotOutlined />,
        label: t("nav.chat"),
      },
      {
        key: "/settings",
        icon: <SettingOutlined />,
        label: t("nav.settings"),
      },
    ],
    [t],
  );

  const displayName =
    user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "User";
  const displayEmail = user?.email ?? "";
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  function handleMenuClick(info: { key: string }): void {
    navigate(info.key);
  }

  function handleLogout(): void {
    signOut();
  }

  function handleAllocateNow(): void {
    navigate("/chat");
    dismissReminder();
  }

  return (
    <Layout className={styles.layoutContainer}>
      <Sider
        width={260}
        className={styles.sidebar}
        breakpoint="lg"
        collapsedWidth={0}
      >
        <div className={styles.sidebarInner}>
          <div className={styles.logo} onClick={() => navigate("/")}>
            <div className={styles.logoIcon}>IT</div>
            <span className={styles.logoText}>{t("app.name")}</span>
          </div>

          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            className={styles.navMenu}
          />

          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              <Avatar
                src={avatarUrl}
                size={36}
                className={styles.userAvatar}
                style={{ backgroundColor: "var(--accent-primary)" }}
              >
                {displayName[0]?.toUpperCase()}
              </Avatar>
              <div>
                <div className={styles.userName}>{displayName}</div>
                <div className={styles.userEmail}>{displayEmail}</div>
              </div>
            </div>
            <Button
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              className={styles.logoutButton}
              size="small"
            >
              {t("nav.logout")}
            </Button>
          </div>
        </div>
      </Sider>

      <Content className={styles.contentArea}>
        {shouldShowReminder && (
          <div className={styles.salaryBanner}>
            <div className={styles.salaryBannerText}>
              <span className={styles.salaryBannerTitle}>
                {t("salary.reminderTitle")}
              </span>
              <span className={styles.salaryBannerMessage}>
                {t("salary.reminderMessage")}
              </span>
            </div>
            <Space>
              <Button type="primary" onClick={handleAllocateNow}>
                {t("salary.allocateNow")}
              </Button>
              <Button onClick={dismissReminder}>{t("salary.dismiss")}</Button>
            </Space>
          </div>
        )}
        <Outlet />
      </Content>

      {/* Mobile bottom navigation */}
      <nav className={styles.mobileBottomNav}>
        <ul className={styles.mobileNavList}>
          {menuItems.map((navItem) => (
            <li
              key={navItem.key}
              className={`${styles.mobileNavItem} ${location.pathname === navItem.key ? styles.mobileNavItemActive : ""}`}
              onClick={() => navigate(navItem.key)}
            >
              <span className={styles.mobileNavIcon}>{navItem.icon}</span>
              {navItem.label}
            </li>
          ))}
        </ul>
      </nav>
    </Layout>
  );
}

export default AppLayout;
