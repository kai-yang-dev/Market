import { Message } from './api';

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class NotificationService {
  private permission: NotificationPermission = 'default';
  private isSubscribed = false;
  private registration: ServiceWorkerRegistration | null = null;

  async initialize() {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.warn('This browser does not support service workers');
      return false;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered:', this.registration);

      // Request notification permission
      await this.requestPermission();

      // Subscribe to push notifications if permission granted
      if (this.permission === 'granted') {
        await this.subscribeToPush();
      }

      return true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (this.permission === 'granted' || this.permission === 'denied') {
      return this.permission;
    }

    this.permission = await Notification.requestPermission();
    return this.permission;
  }

  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration) {
      console.error('Service worker not registered');
      return null;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      
      if (subscription) {
        this.isSubscribed = true;
        const subscriptionObject = this.subscriptionToObject(subscription);
        // Send existing subscription to backend to ensure it's saved
        await this.sendSubscriptionToBackend(subscriptionObject);
        return subscriptionObject;
      }

      // Create new subscription
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn('VAPID public key not configured');
        return null;
      }

      const newSubscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
      });

      this.isSubscribed = true;
      const subscriptionObject = this.subscriptionToObject(newSubscription);

      // Send subscription to backend
      await this.sendSubscriptionToBackend(subscriptionObject);

      return subscriptionObject;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }

  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        this.isSubscribed = false;
        
        // Notify backend
        await this.removeSubscriptionFromBackend();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }

  private subscriptionToObject(subscription: any): PushSubscription {
    const key = subscription.getKey('p256dh');
    const auth = subscription.getKey('auth');
    
    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: key ? this.arrayBufferToBase64(key) : '',
        auth: auth ? this.arrayBufferToBase64(auth) : '',
      },
    };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private async sendSubscriptionToBackend(subscription: PushSubscription) {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/notifications/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ subscription }),
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to backend');
      }
    } catch (error) {
      console.error('Error sending subscription to backend:', error);
    }
  }

  private async removeSubscriptionFromBackend() {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/notifications/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Error removing subscription from backend:', error);
    }
  }

  showBrowserNotification(title: string, options: NotificationOptions) {
    if (this.permission !== 'granted') {
      return;
    }

    if (this.registration) {
      this.registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  }

  shouldShowNotification(): boolean {
    // Show notification if:
    // 1. Tab is hidden
    // 2. Window is not focused
    // 3. Document is hidden
    return (
      document.hidden ||
      !document.hasFocus() ||
      document.visibilityState === 'hidden'
    );
  }

  handleChatMessage(message: Message) {
    if (!this.shouldShowNotification()) {
      return; // User is actively viewing the site
    }

    const senderName = message.sender
      ? `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || message.sender.userName || 'Someone'
      : 'Someone';

    const notificationOptions: NotificationOptions = {
      body: message.message,
      icon: message.sender?.avatar || '/favicon.ico',
      badge: '/favicon.ico',
      tag: `chat-${message.conversationId}`,
      data: {
        url: `/chat/${message.conversationId}`,
        conversationId: message.conversationId,
        messageId: message.id,
      },
      requireInteraction: false,
      silent: false,
    };

    this.showBrowserNotification(senderName, notificationOptions);
  }

  getPermission(): NotificationPermission {
    return this.permission;
  }

  isPushSubscribed(): boolean {
    return this.isSubscribed;
  }
}

export const notificationService = new NotificationService();

