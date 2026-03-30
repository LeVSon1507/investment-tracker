import { type ReactElement, useState } from 'react';
import { Form, Input, Button, Divider, message } from 'antd';
import { GoogleOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import styles from './LoginPage.module.css';

type AuthMode = 'login' | 'register';

type AuthFormValues = {
  email: string;
  password: string;
};

function LoginPage(): ReactElement {
  const { t } = useTranslation();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form] = Form.useForm<AuthFormValues>();

  async function handleEmailSubmit(values: AuthFormValues): Promise<void> {
    setIsSubmitting(true);

    const isLoginMode = authMode === 'login';
    const authAction = isLoginMode ? signInWithEmail : signUpWithEmail;
    const { error } = await authAction(values.email, values.password);

    if (error) {
      message.error(error);
    } else if (!isLoginMode) {
      message.success(t('auth.registerSuccess'));
    }

    setIsSubmitting(false);
  }

  function toggleAuthMode(): void {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
    form.resetFields();
  }

  const isLoginMode = authMode === 'login';

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginHeader}>
          <div className={styles.loginLogo}>IT</div>
          <h1 className={styles.loginTitle}>{t('app.name')}</h1>
          <p className={styles.loginSubtitle}>{t('app.tagline')}</p>
        </div>

        <Button
          className={styles.googleButton}
          icon={<GoogleOutlined className={styles.googleIcon} />}
          onClick={signInWithGoogle}
          size="large"
        >
          {t('auth.loginWithGoogle')}
        </Button>

        <Divider className={styles.divider}>
          <span>{t('auth.orDivider')}</span>
        </Divider>

        <Form
          form={form}
          onFinish={handleEmailSubmit}
          layout="vertical"
          requiredMark={false}
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '' },
              { type: 'email', message: '' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder={t('auth.email')}
              className={styles.formInput}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '' },
              { min: 6, message: '' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('auth.password')}
              className={styles.formInput}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              className={styles.submitButton}
            >
              {isLoginMode ? t('auth.login') : t('auth.register')}
            </Button>
          </Form.Item>
        </Form>

        <div className={styles.switchAuth}>
          {isLoginMode ? t('auth.noAccount') : t('auth.hasAccount')}
          <span className={styles.switchAuthLink} onClick={toggleAuthMode}>
            {isLoginMode ? t('auth.registerNow') : t('auth.loginNow')}
          </span>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
