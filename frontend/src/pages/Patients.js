import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Card,
  CardContent,
  Alert,
  Tooltip,
  Stack,
  Avatar,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Clear as ClearIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  LocalHospital as HospitalIcon,
  Warning as WarningIcon,
  Medication as MedicationIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import { patientsAPI, allergiesAPI, drugsAPI } from '../services/api';
import PrescriptionDialog from '../components/PrescriptionDialog';
import { prescriptionsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const Patients = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [filterBy, setFilterBy] = useState('all');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [allergies, setAllergies] = useState([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    medical_history: '',
    blood_group: '',
    height: '',
    weight: '',
    detailed_allergies: [],
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false);
  const [prescriptionDialogPatient, setPrescriptionDialogPatient] = useState(null);
  const [prescriptionDialogError, setPrescriptionDialogError] = useState('');
  const [prescriptionDialogLoading, setPrescriptionDialogLoading] = useState(false);
  const [prescriptionDialogBackendWarning, setPrescriptionDialogBackendWarning] = useState('');
  const [drugs, setDrugs] = useState([]);
  const [showNewAllergyForm, setShowNewAllergyForm] = useState(false);
  const [newAllergyName, setNewAllergyName] = useState('');
  const [newAllergyDescription, setNewAllergyDescription] = useState('');
  const [newAllergyLoading, setNewAllergyLoading] = useState(false);
  const [newAllergyError, setNewAllergyError] = useState('');
  const [creatingAllergyFromDrug, setCreatingAllergyFromDrug] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchPatients();
    fetchAllergies();
    fetchDrugs();
    // Optionally, clear patients state on unmount
    return () => setPatients([]);
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await patientsAPI.getAll();
      setPatients(res.data);
    } catch (err) {
      setError('Failed to load patients.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllergies = async () => {
    try {
      const res = await allergiesAPI.getAll();
      setAllergies(res.data);
    } catch (err) {
      // Optionally handle error
    }
  };

  const fetchDrugs = async () => {
    try {
      const res = await drugsAPI.getAll();
      setDrugs(res.data);
    } catch (err) {
      setDrugs([]);
    }
  };

  // Enhanced filtering and sorting logic
  const filteredAndSortedPatients = React.useMemo(() => {
    let filtered = patients.filter(patient => {
      // Search filter
      const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
      const matchesSearch = (
        fullName.includes(searchTerm.toLowerCase()) ||
        (patient.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (patient.phone || '').includes(searchTerm) ||
        patient.id.toString().includes(searchTerm)
      );

      if (!matchesSearch) return false;

      // Additional filters
      switch (filterBy) {
        case 'has_allergies':
          return (patient.detailed_allergies || []).length > 0;
        case 'has_active_prescriptions':
          // This would need to be implemented based on prescription data
          return true; // Placeholder
        case 'has_conflicts':
          // This would need to be implemented based on conflict data
          return true; // Placeholder
        default:
          return true;
      }
    });

    // Sorting logic
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        case 'name_desc':
          return `${b.first_name} ${b.last_name}`.localeCompare(`${a.first_name} ${a.last_name}`);
        case 'age_asc':
          return a.age - b.age;
        case 'age_desc':
          return b.age - a.age;
        case 'last_visit_newest':
          // This would need to be implemented based on visit data
          return 0; // Placeholder
        case 'last_visit_oldest':
          // This would need to be implemented based on visit data
          return 0; // Placeholder
        default:
          return 0;
      }
    });

    return filtered;
  }, [patients, searchTerm, sortBy, filterBy]);

  const clearSearch = () => {
    setSearchTerm('');
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpenDialog = (patient = null) => {
    setSelectedPatient(patient);
    if (patient) {
      setFormData({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        date_of_birth: patient.date_of_birth || '',
        gender: patient.gender || '',
        phone: patient.phone || '',
        email: patient.email || '',
        address: patient.address || '',
        medical_history: patient.medical_history || '',
        detailed_allergies: (patient.detailed_allergies || []).map(a => ({
          allergy_id: a.allergy?.id,
          reaction: a.reaction || '',
          date_noted: a.date_noted || '',
          severity: a.severity || '',
        })),
      });
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        gender: '',
        phone: '',
        email: '',
        address: '',
        medical_history: '',
        detailed_allergies: [],
      });
    }
    setFormError('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPatient(null);
    setFormError('');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setFormError('');
  };

  const handleAllergyChange = (event) => {
    setFormData({ ...formData, allergies: event.target.value });
  };

  // Allergy management handlers
  const handleAddAllergy = () => {
    setFormData({
      ...formData,
      detailed_allergies: [
        ...formData.detailed_allergies,
        { allergy_id: '', reaction: '', date_noted: '', severity: '' },
      ],
    });
  };
  const handleAllergyFieldChange = async (idx, field, value) => {
    if (field === 'allergy_id' && value && value !== '__add_new__') {
      // Check if it's a drug selection (starts with 'drug-')
      if (value.startsWith('drug-')) {
        const drugId = value.replace('drug-', '');
        const selectedDrug = drugs.find(drug => drug.id.toString() === drugId);
        
        if (selectedDrug) {
          setCreatingAllergyFromDrug(true);
          try {
            // Check if allergy already exists for this drug
            let allergyId = allergies.find(allergy => allergy.name === selectedDrug.name)?.id;
            
            if (!allergyId) {
              // Create new allergy entry with drug name
              const res = await allergiesAPI.create({ 
                name: selectedDrug.name, 
                description: `Allergy to ${selectedDrug.name} (${selectedDrug.therapeutic_class || selectedDrug.category})` 
              });
              allergyId = res.data.id;
              setAllergies([...allergies, res.data]);
            }
            
            // Update the form data with the allergy ID
            const updated = formData.detailed_allergies.map((a, i) =>
              i === idx ? { ...a, [field]: allergyId } : a
            );
            setFormData({ ...formData, detailed_allergies: updated });
          } catch (err) {
            console.error('Failed to create allergy for drug:', err);
            setNewAllergyError('Failed to create allergy for selected drug.');
          } finally {
            setCreatingAllergyFromDrug(false);
          }
        }
      } else {
        // It's a regular allergy selection
        const updated = formData.detailed_allergies.map((a, i) =>
          i === idx ? { ...a, [field]: value } : a
        );
        setFormData({ ...formData, detailed_allergies: updated });
      }
    } else if (field === 'allergy_id' && value === '__add_new__') {
      // Handle the "Add New Allergy" option
      setShowNewAllergyForm(true);
    } else {
      // For other fields, update normally
      const updated = formData.detailed_allergies.map((a, i) =>
        i === idx ? { ...a, [field]: value } : a
      );
      setFormData({ ...formData, detailed_allergies: updated });
    }
  };
  const handleRemoveAllergy = (idx) => {
    setFormData({
      ...formData,
      detailed_allergies: formData.detailed_allergies.filter((_, i) => i !== idx),
    });
  };

  // Handler to add new allergy
  const handleCreateNewAllergy = async () => {
    if (!newAllergyName.trim()) {
      setNewAllergyError('Allergy name is required');
      return;
    }
    setNewAllergyLoading(true);
    setNewAllergyError('');
    try {
      const res = await allergiesAPI.create({ name: newAllergyName, description: newAllergyDescription });
      setAllergies([...allergies, res.data]);
      setShowNewAllergyForm(false);
      setNewAllergyName('');
      setNewAllergyDescription('');
      // Optionally auto-select the new allergy in the last allergy row
      setFormData((prev) => {
        const updated = [...prev.detailed_allergies];
        if (updated.length > 0) {
          updated[updated.length - 1].allergy_id = res.data.id;
        }
        return { ...prev, detailed_allergies: updated };
      });
    } catch (err) {
      setNewAllergyError('Failed to create allergy.');
    } finally {
      setNewAllergyLoading(false);
    }
  };

  const handleFormSubmit = async () => {
    setFormLoading(true);
    setFormError('');
    try {
      // Always send the full detailed_allergies array
      const submitData = { ...formData, detailed_allergies: formData.detailed_allergies };
      if (selectedPatient) {
        await patientsAPI.update(selectedPatient.id, submitData);
      } else {
        await patientsAPI.create(submitData);
      }
      fetchPatients();
      handleCloseDialog();
    } catch (err) {
      setFormError('Failed to save patient.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this patient?')) return;
    try {
      await patientsAPI.delete(id);
      fetchPatients();
    } catch (err) {
      alert('Failed to delete patient.');
    }
  };

  const handleOpenPrescriptionDialog = (patient) => {
    setPrescriptionDialogPatient(patient);
    setPrescriptionDialogOpen(true);
    setPrescriptionDialogError('');
    setPrescriptionDialogBackendWarning('');
  };
  const handleClosePrescriptionDialog = () => {
    setPrescriptionDialogOpen(false);
    setPrescriptionDialogPatient(null);
    setPrescriptionDialogError('');
    setPrescriptionDialogBackendWarning('');
  };
  const handleCreatePrescription = async (data) => {
    setPrescriptionDialogLoading(true);
    setPrescriptionDialogError('');
    setPrescriptionDialogBackendWarning('');
    try {
      const response = await prescriptionsAPI.create(data);
      if (response && response.data && response.data.allergy_warning) {
        setPrescriptionDialogBackendWarning(response.data.allergy_warning);
      } else {
        handleClosePrescriptionDialog();
      }
    } catch (err) {
      setPrescriptionDialogError('Failed to create prescription.');
    } finally {
      setPrescriptionDialogLoading(false);
    }
  };

  const getStatusChip = (status) => {
    return (
      <Chip
        label={status === 'Active' ? 'Active' : 'Inactive'}
        color={status === 'Active' ? 'success' : 'default'}
        size="small"
      />
    );
  };

  // Allergy severity options
  const allergySeverityOptions = [
    { value: 'mild', label: 'Mild' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'severe', label: 'Severe' },
  ];

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: '#F7F9FC',
      p: 3,
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h3" sx={{ 
              fontWeight: 700, 
              color: '#212529',
              fontSize: '2.5rem',
              mb: 1
            }}>
              Patients
            </Typography>
            <Typography variant="h6" sx={{ 
              color: '#6c757d',
              fontWeight: 400
            }}>
              Manage patient records and information
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              bgcolor: '#4A90E2',
              borderRadius: 2,
              px: 3,
              py: 1.5,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              '&:hover': {
                bgcolor: '#357ABD'
              }
            }}
          >
            Add Patient
          </Button>
        </Box>
      </Box>

      {/* Search and Filter Section */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #E8ECF0', mb: 3 }}>
        <Box sx={{ p: 3 }}>
          {/* Search Bar */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search patients by name, email, phone, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#6c757d' }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={clearSearch}
                      edge="end"
                      size="small"
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 2,
                  bgcolor: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#E8ECF0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#4A90E2',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#4A90E2',
                  },
                }
              }}
            />
          </Box>

          {/* Filter and Sort Controls */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2
          }}>
            <Typography variant="body1" sx={{ 
              color: '#6c757d',
              fontWeight: 500
            }}>
              {filteredAndSortedPatients.length} patients found
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  label="Sort By"
                  sx={{
                    borderRadius: 2,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#E8ECF0',
                    },
                  }}
                >
                  <MenuItem value="name_asc">Name (A-Z)</MenuItem>
                  <MenuItem value="name_desc">Name (Z-A)</MenuItem>
                  <MenuItem value="age_asc">Age (Low to High)</MenuItem>
                  <MenuItem value="age_desc">Age (High to Low)</MenuItem>
                  <MenuItem value="last_visit_newest">Last Visit (Newest)</MenuItem>
                  <MenuItem value="last_visit_oldest">Last Visit (Oldest)</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Filter By</InputLabel>
                <Select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value)}
                  label="Filter By"
                  sx={{
                    borderRadius: 2,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#E8ECF0',
                    },
                  }}
                >
                  <MenuItem value="all">All Patients</MenuItem>
                  <MenuItem value="has_allergies">Has Allergies</MenuItem>
                  <MenuItem value="has_active_prescriptions">Has Active Prescriptions</MenuItem>
                  <MenuItem value="has_conflicts">Has Conflicts</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Patient Cards Grid */}
      <Grid container spacing={3}>
        {filteredAndSortedPatients.length === 0 && !loading && !error && (
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ 
              borderRadius: 3, 
              border: '1px solid #E8ECF0',
              p: 6,
              textAlign: 'center'
            }}>
              <PersonIcon sx={{ fontSize: 64, color: '#E0E0E0', mb: 2 }} />
              <Typography variant="h6" sx={{ color: '#6c757d', mb: 1 }}>
                No patients found
              </Typography>
              <Typography variant="body2" sx={{ color: '#6c757d' }}>
                Try adjusting your search or filter criteria
              </Typography>
            </Paper>
          </Grid>
        )}
        
        {filteredAndSortedPatients.map((patient) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={patient.id}>
            <Card 
              elevation={0}
              sx={{ 
                borderRadius: 3,
                border: '1px solid #E8ECF0',
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(74, 144, 226, 0.15)',
                  borderColor: '#4A90E2'
                }
              }}
              onClick={() => navigate(`/patients/${patient.id}`)}
            >
              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Patient Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ 
                    width: 48, 
                    height: 48, 
                    bgcolor: '#4A90E2',
                    fontSize: '1.2rem',
                    fontWeight: 600,
                    mr: 2
                  }}>
                    {patient.first_name?.[0]}{patient.last_name?.[0]}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ 
                      fontWeight: 700, 
                      color: '#212529',
                      fontSize: '1.25rem',
                      lineHeight: 1.2
                    }}>
                      {patient.first_name} {patient.last_name}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: '#6c757d',
                      fontSize: '0.9rem'
                    }}>
                      Age: {patient.age} • {patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : 'Other'}
                    </Typography>
                  </Box>
                </Box>

                {/* Contact Information */}
                <Box sx={{ mb: 2 }}>
                  {patient.phone && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <PhoneIcon sx={{ fontSize: 16, color: '#6c757d', mr: 1 }} />
                      <Typography variant="body2" sx={{ color: '#6c757d', fontSize: '0.9rem' }}>
                        {patient.phone}
                      </Typography>
                    </Box>
                  )}
                  {patient.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <EmailIcon sx={{ fontSize: 16, color: '#6c757d', mr: 1 }} />
                      <Typography variant="body2" sx={{ color: '#6c757d', fontSize: '0.9rem' }}>
                        {patient.email}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Physical Information */}
                <Box sx={{ mb: 2 }}>
                  {(patient.height || patient.weight) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {patient.height && (
                        <Typography variant="body2" sx={{ color: '#6c757d', fontSize: '0.9rem' }}>
                          Height: {patient.height} cm
                        </Typography>
                      )}
                      {patient.weight && (
                        <Typography variant="body2" sx={{ color: '#6c757d', fontSize: '0.9rem' }}>
                          Weight: {patient.weight} kg
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>

                {/* Allergies and Medications */}
                <Box sx={{ mb: 2, flex: 1 }}>
                  {(patient.detailed_allergies || []).length > 0 && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ color: '#6c757d', fontWeight: 600 }}>
                        Allergies:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {(patient.detailed_allergies || []).slice(0, 2).map((allergy, index) => (
                          <Chip 
                            key={index}
                            label={allergy.allergy?.name || 'Unknown'} 
                            size="small" 
                            variant="outlined"
                            color="error"
                            sx={{ fontSize: '0.75rem' }}
                          />
                        ))}
                        {(patient.detailed_allergies || []).length > 2 && (
                          <Chip 
                            label={`+${patient.detailed_allergies.length - 2} more`} 
                            size="small" 
                            variant="outlined"
                            sx={{ fontSize: '0.75rem' }}
                          />
                        )}
                      </Box>
                    </Box>
                  )}
                </Box>

                {/* Action Buttons */}
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1, 
                  pt: 2,
                  borderTop: '1px solid #E8ECF0'
                }}>
                  <Tooltip title="View Profile">
                    <IconButton 
                      size="small"
                      onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patient.id}`); }}
                      sx={{ color: '#4A90E2' }}
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Edit Patient">
                    <IconButton 
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleOpenDialog(patient); }}
                      sx={{ color: '#6c757d' }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Add Prescription">
                    <IconButton 
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleOpenPrescriptionDialog(patient); }}
                      sx={{ 
                        color: '#00C49F',
                        bgcolor: 'rgba(0, 196, 159, 0.1)',
                        '&:hover': {
                          bgcolor: 'rgba(0, 196, 159, 0.2)'
                        }
                      }}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Delete Patient">
                    <IconButton 
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleDelete(patient.id); }}
                      sx={{ color: '#D32F2F' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Pagination */}
      {filteredAndSortedPatients.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredAndSortedPatients.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              '& .MuiTablePagination-toolbar': {
                bgcolor: 'white',
                borderRadius: 2,
                border: '1px solid #E8ECF0'
              }
            }}
          />
        </Box>
      )}

      {/* Patient Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedPatient ? 'Edit Patient' : 'Add New Patient'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                name="first_name"
                value={formData.first_name}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                name="last_name"
                value={formData.last_name}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date of Birth"
                name="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={handleFormChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  label="Gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleFormChange}
                >
                  <MenuItem value="M">Male</MenuItem>
                  <MenuItem value="F">Female</MenuItem>
                  <MenuItem value="O">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                name="phone"
                value={formData.phone}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                name="address"
                multiline
                rows={3}
                value={formData.address}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Medical History"
                name="medical_history"
                multiline
                rows={3}
                value={formData.medical_history}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Blood Group</InputLabel>
                <Select
                  label="Blood Group"
                  name="blood_group"
                  value={formData.blood_group}
                  onChange={handleFormChange}
                >
                  <MenuItem value="A+">A+</MenuItem>
                  <MenuItem value="A-">A-</MenuItem>
                  <MenuItem value="B+">B+</MenuItem>
                  <MenuItem value="B-">B-</MenuItem>
                  <MenuItem value="AB+">AB+</MenuItem>
                  <MenuItem value="AB-">AB-</MenuItem>
                  <MenuItem value="O+">O+</MenuItem>
                  <MenuItem value="O-">O-</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Height (cm)"
                name="height"
                type="number"
                value={formData.height}
                onChange={handleFormChange}
                inputProps={{ min: 50, max: 300, step: 0.1 }}
                helperText="Height in centimeters"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Weight (kg)"
                name="weight"
                type="number"
                value={formData.weight}
                onChange={handleFormChange}
                inputProps={{ min: 1, max: 500, step: 0.1 }}
                helperText="Weight in kilograms"
              />
            </Grid>
            {formData.height && formData.weight && (
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>BMI:</strong> {(() => {
                      const heightM = parseFloat(formData.height) / 100;
                      const weightKg = parseFloat(formData.weight);
                      const bmi = (weightKg / (heightM * heightM)).toFixed(1);
                      let category = '';
                      if (bmi < 18.5) category = 'Underweight';
                      else if (bmi < 25) category = 'Normal weight';
                      else if (bmi < 30) category = 'Overweight';
                      else category = 'Obese';
                      return `${bmi} (${category})`;
                    })()}
                  </Typography>
                </Alert>
              </Grid>
            )}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 1 }}>Allergies</Typography>
              <Divider sx={{ mb: 2 }} />
              {formData.detailed_allergies.length === 0 && (
                <Typography variant="body2" color="text.secondary">No allergies added.</Typography>
              )}
              {formData.detailed_allergies.map((a, idx) => (
                <Paper key={idx} elevation={2} sx={{ mb: 2, p: 2 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth>
                        <InputLabel>Allergy</InputLabel>
                        <Select
                          value={a.allergy_id || ''}
                          onChange={e => handleAllergyFieldChange(idx, 'allergy_id', e.target.value)}
                          disabled={creatingAllergyFromDrug}
                          renderValue={selected => {
                            const found = allergies.find(allergy => allergy.id === selected);
                            return found ? found.name : '';
                          }}
                        >
                          {allergies.map((allergy) => (
                            <MenuItem key={allergy.id} value={allergy.id}>
                              {allergy.name}
                            </MenuItem>
                          ))}
                          <Divider />
                          <Typography variant="subtitle2" sx={{ px: 2, py: 1, color: 'text.secondary' }}>
                            Add Medicine as Allergy:
                          </Typography>
                          {drugs.map((drug) => (
                            <MenuItem key={`drug-${drug.id}`} value={`drug-${drug.id}`}>
                              {drug.name}
                            </MenuItem>
                          ))}
                          <MenuItem value="__add_new__" onClick={() => setShowNewAllergyForm(true)}>
                            + Add Custom Allergy
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Reaction/Notes"
                        value={a.reaction || ''}
                        onChange={e => handleAllergyFieldChange(idx, 'reaction', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        label="Date Noted"
                        type="date"
                        value={a.date_noted || ''}
                        onChange={e => handleAllergyFieldChange(idx, 'date_noted', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      <FormControl fullWidth>
                        <InputLabel>Severity</InputLabel>
                        <Select
                          value={a.severity || ''}
                          onChange={e => handleAllergyFieldChange(idx, 'severity', e.target.value)}
                          label="Severity"
                        >
                          {allergySeverityOptions.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={1} sx={{ textAlign: 'right' }}>
                      <IconButton color="error" onClick={() => handleRemoveAllergy(idx)}>
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
              <Button
                variant="outlined"
                size="medium"
                onClick={handleAddAllergy}
                sx={{ mt: 1, display: 'block', mx: 'auto' }}
                startIcon={<AddIcon />}
              >
                Add Allergy
              </Button>
            </Grid>
            {formError && (
              <Grid item xs={12}>
                <Typography color="error">{formError}</Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleFormSubmit} disabled={formLoading}>
            {selectedPatient ? 'Update' : 'Add'} Patient
          </Button>
        </DialogActions>
      </Dialog>

      {/* Prescription Dialog */}
      <PrescriptionDialog
        open={prescriptionDialogOpen}
        onClose={handleClosePrescriptionDialog}
        onSubmit={handleCreatePrescription}
        patients={patients}
        drugs={drugs}
        initialPatient={prescriptionDialogPatient ? prescriptionDialogPatient.id : ''}
        loading={prescriptionDialogLoading}
        error={prescriptionDialogError}
        backendWarning={prescriptionDialogBackendWarning}
      />

      {showNewAllergyForm && (
        <Box sx={{ mt: 1, mb: 2, p: 2, border: '1px solid #eee', borderRadius: 1 }}>
          <Typography variant="subtitle2">Add New Allergy</Typography>
          <TextField
            fullWidth
            label="Allergy Name"
            value={newAllergyName}
            onChange={e => setNewAllergyName(e.target.value)}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            label="Description (optional)"
            value={newAllergyDescription}
            onChange={e => setNewAllergyDescription(e.target.value)}
            sx={{ mb: 1 }}
          />
          {newAllergyError && <Typography color="error">{newAllergyError}</Typography>}
          <Box display="flex" gap={1}>
            <Button variant="contained" size="small" onClick={handleCreateNewAllergy} disabled={newAllergyLoading}>
              Add
            </Button>
            <Button size="small" onClick={() => setShowNewAllergyForm(false)} disabled={newAllergyLoading}>
              Cancel
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Patients; 