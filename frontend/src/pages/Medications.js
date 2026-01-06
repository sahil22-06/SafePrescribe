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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  OutlinedInput,
  Checkbox,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  Category as CategoryIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { drugsAPI } from '../services/api';
import { allergiesAPI } from '../services/api';

const Medications = () => {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    generic_name: '',
    strength: '',
    form: '',
    category: '',
    manufacturer: '',
    dosage_instructions: '',
    side_effects: '',
    contraindications: '',
    interactions: '',
    availability: 'available',
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [allergies, setAllergies] = useState([]);

  useEffect(() => {
    fetchMedications();
    fetchAllergies();
    // Optionally, clear medications state on unmount
    return () => setMedications([]);
  }, []);

  const fetchMedications = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await drugsAPI.getAll();
      setMedications(res.data);
    } catch (err) {
      setError('Failed to load medications.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllergies = async () => {
    try {
      const res = await allergiesAPI.getAll();
      setAllergies(res.data);
    } catch (err) {
      setAllergies([]);
    }
  };

  const filteredMedications = medications.filter(medication => {
    return (
      (medication.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (medication.generic_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (medication.category || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpenDialog = (medication = null) => {
    setSelectedMedication(medication);
    if (medication) {
      setFormData({
        name: medication.name || '',
        generic_name: medication.generic_name || '',
        strength: medication.strength || '',
        form: medication.form || '',
        category: medication.category || '',
        manufacturer: medication.manufacturer || '',
        dosage_instructions: medication.dosage_instructions || '',
        side_effects: medication.side_effects || '',
        contraindications: medication.contraindications || '',
        interactions: medication.interactions || '',
        availability: medication.availability || 'available',
      });
    } else {
      setFormData({
        name: '',
        generic_name: '',
        strength: '',
        form: '',
        category: '',
        manufacturer: '',
        dosage_instructions: '',
        side_effects: '',
        contraindications: '',
        interactions: '',
        availability: 'available',
      });
    }
    setFormError('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedMedication(null);
    setFormError('');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setFormError('');
  };

  const handleAllergyConflictsChange = (event) => {
    setFormData({ ...formData, allergy_conflicts: event.target.value });
  };

  const handleFormSubmit = async () => {
    setFormLoading(true);
    setFormError('');
    try {
      await drugsAPI.create({ ...formData, allergy_conflicts: formData.allergy_conflicts || [] });
      fetchMedications();
      handleCloseDialog();
    } catch (err) {
      setFormError('Failed to save medication.');
    } finally {
      setFormLoading(false);
    }
  };

  const getAvailabilityChip = (availability) => {
    return (
      <Chip
        label={availability === 'available' ? 'Available' : availability === 'out_of_stock' ? 'Out of Stock' : 'Discontinued'}
        color={availability === 'available' ? 'success' : 'error'}
        size="small"
      />
    );
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Medications</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Medication
        </Button>
      </Box>

      <Paper elevation={2}>
        <Box p={3}>
          <Grid container spacing={2} alignItems="center" mb={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search medications by name, generic name, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box display="flex" gap={1} justifyContent="flex-end">
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  {filteredMedications.length} medications found
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Medication</TableCell>
                  <TableCell>Generic Name</TableCell>
                  <TableCell>Strength & Form</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Interactions</TableCell>
                  <TableCell>Availability</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">Loading...</TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" style={{ color: 'red' }}>{error}</TableCell>
                  </TableRow>
                ) : filteredMedications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">No medications found.</TableCell>
                  </TableRow>
                ) : (
                  filteredMedications
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((medication) => {
                      const interactions = (medication.interactions || '').split(',').map(s => s.trim()).filter(Boolean);
                      return (
                        <TableRow key={medication.id} hover>
                          <TableCell>
                            <Typography variant="body1" fontWeight="medium">
                              {medication.name}
                            </Typography>
                          </TableCell>
                          <TableCell>{medication.generic_name}</TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {medication.strength}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {medication.form}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={medication.category}
                              size="small"
                              icon={<CategoryIcon />}
                            />
                          </TableCell>
                          <TableCell>
                            {interactions.length > 0 ? (
                              <Chip
                                label={`${interactions.length} interactions`}
                                color="warning"
                                size="small"
                                icon={<WarningIcon />}
                              />
                            ) : (
                              <Chip label="None" size="small" color="success" />
                            )}
                          </TableCell>
                          <TableCell>{getAvailabilityChip(medication.availability)}</TableCell>
                          <TableCell>
                            <Box display="flex" gap={1}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenDialog(medication)}
                              >
                                <ViewIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenDialog(medication)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredMedications.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Box>
      </Paper>

      {/* Medication Details Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedMedication ? 'Medication Details' : 'Add New Medication'}
        </DialogTitle>
        <DialogContent>
          {selectedMedication ? (
            <Box>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Medication Name"
                    value={selectedMedication.name}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Generic Name"
                    value={selectedMedication.generic_name}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Strength"
                    value={selectedMedication.strength}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Form"
                    value={selectedMedication.form}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Category"
                    value={selectedMedication.category}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Manufacturer"
                    value={selectedMedication.manufacturer}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Dosage"
                    value={selectedMedication.dosage_instructions}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              </Grid>
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" color="warning.main">
                    <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Drug Interactions ({(selectedMedication.interactions || '').split(',').filter(Boolean).length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {(selectedMedication.interactions || '').split(',').map((interaction, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={interaction.trim()} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" color="error.main">
                    <InfoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Side Effects ({(selectedMedication.side_effects || '').split(',').filter(Boolean).length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {(selectedMedication.side_effects || '').split(',').map((effect, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={effect.trim()} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" color="error.main">
                    <InfoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Contraindications ({(selectedMedication.contraindications || '').split(',').filter(Boolean).length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {(selectedMedication.contraindications || '').split(',').map((contraindication, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={contraindication.trim()} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            </Box>
          ) : (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Medication Name"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="Enter medication name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Generic Name"
                  name="generic_name"
                  value={formData.generic_name}
                  onChange={handleFormChange}
                  placeholder="Enter generic name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Strength"
                  name="strength"
                  value={formData.strength}
                  onChange={handleFormChange}
                  placeholder="e.g., 10mg"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Form"
                  name="form"
                  value={formData.form}
                  onChange={handleFormChange}
                  placeholder="e.g., Tablet, Capsule"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Category"
                  name="category"
                  value={formData.category}
                  onChange={handleFormChange}
                  placeholder="e.g., ACE Inhibitor"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Manufacturer"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleFormChange}
                  placeholder="Enter manufacturer"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Dosage Instructions"
                  name="dosage_instructions"
                  value={formData.dosage_instructions}
                  onChange={handleFormChange}
                  multiline
                  rows={3}
                  placeholder="Enter dosage instructions..."
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Side Effects (comma separated)"
                  name="side_effects"
                  value={formData.side_effects}
                  onChange={handleFormChange}
                  placeholder="e.g., Nausea, Dizziness"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Contraindications (comma separated)"
                  name="contraindications"
                  value={formData.contraindications}
                  onChange={handleFormChange}
                  placeholder="e.g., Pregnancy, Liver disease"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Interactions (comma separated)"
                  name="interactions"
                  value={formData.interactions}
                  onChange={handleFormChange}
                  placeholder="e.g., Warfarin, NSAIDs"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Availability"
                  name="availability"
                  value={formData.availability}
                  onChange={handleFormChange}
                  placeholder="available, out_of_stock, discontinued"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Allergy Conflicts</InputLabel>
                  <Select
                    label="Allergy Conflicts"
                    multiple
                    value={formData.allergy_conflicts || []}
                    onChange={handleAllergyConflictsChange}
                    input={<OutlinedInput label="Allergy Conflicts" />}
                    renderValue={(selected) =>
                      allergies.filter(a => selected.includes(a.id)).map(a => a.name).join(', ')
                    }
                  >
                    {allergies.map((allergy) => (
                      <MenuItem key={allergy.id} value={allergy.id}>
                        <Checkbox checked={(formData.allergy_conflicts || []).includes(allergy.id)} />
                        <ListItemText primary={allergy.name} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {formError && (
                <Grid item xs={12}>
                  <Typography color="error">{formError}</Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
          {!selectedMedication && (
            <Button variant="contained" onClick={handleFormSubmit} disabled={formLoading}>
              Add Medication
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Medications; 