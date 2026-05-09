from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()


class AuthTests(APITestCase):
    def setUp(self):
        self.register_url = '/api/v1/accounts/register/'
        self.login_url = '/api/v1/accounts/login/'
        self.user_data = {
            'email': 'test@example.com',
            'name': 'Test User',
            'password': 'securepass123',
        }

    def test_register_success(self):
        response = self.client.post(self.register_url, self.user_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('user', response.data)
        self.assertIn('token', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['email'], self.user_data['email'])
        self.assertEqual(response.data['user']['name'], self.user_data['name'])

    def test_register_duplicate_email(self):
        User.objects.create_user(
            email='test@example.com', name='Existing', password='pass12345'
        )
        response = self.client.post(self.register_url, self.user_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_success(self):
        User.objects.create_user(
            email='test@example.com', name='Test User', password='securepass123'
        )
        response = self.client.post(self.login_url, {
            'email': 'test@example.com',
            'password': 'securepass123',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)
        self.assertIn('token', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['email'], 'test@example.com')

    def test_login_wrong_password(self):
        User.objects.create_user(
            email='test@example.com', name='Test User', password='securepass123'
        )
        response = self.client.post(self.login_url, {
            'email': 'test@example.com',
            'password': 'wrongpassword',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
