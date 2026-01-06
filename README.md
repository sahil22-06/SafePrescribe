# SafePrescribe - Medical Prescription Management System

A comprehensive medical prescription management system built with React frontend and Django backend.

## 🏗️ Architecture

- **Frontend**: React 18 + Material-UI + Tailwind CSS
- **Backend**: Django 5 + Django REST Framework + JWT Authentication
- **Database**: SQLite (development) / PostgreSQL (production ready)

## 🚀 Features

### Authentication & User Management
- JWT-based authentication
- Role-based access (Doctor, Pharmacist, Nurse, Administrator)
- User registration with license number validation
- Secure login/logout functionality

### Patient Management
- Complete patient profiles
- Medical history tracking
- Allergy information
- Emergency contact details
- Search and filter capabilities

### Medication Management
- Comprehensive drug database
- Drug interactions tracking
- Side effects and contraindications
- Availability status
- Dosage instructions

### Prescription Management
- Create and manage prescriptions
- Drug interaction warnings
- Prescription status tracking
- Expiry date monitoring
- Refill management

### Dashboard & Analytics
- Real-time statistics
- Recent activity feed
- Quick action buttons
- Responsive design

## 📁 Project Structure

```
Safeprescribe/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── context/        # React context
│   │   ├── services/       # API services
│   │   └── ...
│   └── package.json
├── backend/                 # Django backend
│   ├── backend/            # Django project settings
│   ├── users/              # User management app
│   ├── patients/           # Patient management app
│   ├── drugs/              # Medication management app
│   ├── rx/                 # Prescription management app
│   └── manage.py
└── README.md
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+ and pip
- Git

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run database migrations:**
   ```bash
   python manage.py migrate
   ```

4. **Create superuser (optional):**
   ```bash
   python manage.py createsuperuser
   ```

5. **Start Django development server:**
   ```bash
   python manage.py runserver
   ```

   The backend will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Start React development server:**
   ```bash
   npm start
   ```

   The frontend will be available at `http://localhost:3000`

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - User login
- `GET /api/auth/profile/` - Get user profile
- `PUT /api/auth/profile/update/` - Update user profile

### Patients
- `GET /api/patients/` - List all patients
- `POST /api/patients/` - Create new patient
- `GET /api/patients/{id}/` - Get patient details
- `PUT /api/patients/{id}/` - Update patient
- `DELETE /api/patients/{id}/` - Delete patient
- `GET /api/patients/stats/` - Get patient statistics

### Drugs
- `GET /api/drugs/` - List all drugs
- `POST /api/drugs/` - Create new drug
- `GET /api/drugs/{id}/` - Get drug details
- `PUT /api/drugs/{id}/` - Update drug
- `DELETE /api/drugs/{id}/` - Delete drug
- `GET /api/drugs/stats/` - Get drug statistics

### Prescriptions
- `GET /api/prescriptions/` - List user's prescriptions
- `POST /api/prescriptions/` - Create new prescription
- `GET /api/prescriptions/{id}/` - Get prescription details
- `PUT /api/prescriptions/{id}/` - Update prescription
- `DELETE /api/prescriptions/{id}/` - Delete prescription
- `GET /api/prescriptions/stats/` - Get prescription statistics

## 🔐 Security Features

- JWT token-based authentication
- CORS configuration for frontend-backend communication
- Role-based access control
- Password validation and hashing
- Secure API endpoints with authentication requirements

## 🎨 UI/UX Features

- Modern, responsive design
- Material-UI components
- Tailwind CSS for custom styling
- Dark/light theme support
- Mobile-friendly interface
- Loading states and error handling
- Form validation and user feedback

## 🚀 Deployment

### Backend Deployment
1. Set `DEBUG = False` in settings
2. Configure production database (PostgreSQL recommended)
3. Set up environment variables for secrets
4. Configure static files serving
5. Set up CORS for production domain

### Frontend Deployment
1. Build the production version: `npm run build`
2. Deploy to hosting service (Netlify, Vercel, etc.)
3. Update API base URL for production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions, please open an issue in the repository.

---

**SafePrescribe** - Making prescription management safe and efficient! 💊🏥 