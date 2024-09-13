const express = require('express');
const path = require('path');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Middleware to parse URL-encoded data from POST requests
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the 'results' directory
app.use('/result', express.static(path.join(__dirname, 'results')));
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));

// Serve static files from the 'index_files' directory when accessing '/'
app.use('/index_files', express.static(path.join(__dirname, 'index_files')));

// List of hardcoded hall ticket numbers to check
const monitoredHallTickets = ['23011A6675', '23011A6667', '23011A6668'];

// Handle POST request on /result/jntuhcehpayOne
app.post('/result/jntuhcehpayOne', async (req, res) => {
  const { hallticket, result } = req.body; // Extract hall ticket and result from the request body
  console.log(`Received hall ticket: ${hallticket}, result: ${result}`);

  // Check if the hall ticket is in the monitored list
  if (monitoredHallTickets.includes(hallticket)) {
    console.log('CAUGHT');
  }

  try {
    // Send POST request to the external URL
    const response = await axios.post(
      'https://results.jntuhceh.ac.in/helper.php?jntuhcehpayOne=getResult',
      `hallticket=${hallticket}&result=${result}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
        },
      }
    );

    let htmlContent = response.data; // Get the HTML content from the response

    // Check if the hall ticket is in the monitored list
    if (monitoredHallTickets.includes(hallticket)) {
      // Change "Fail" to "Pass"
      htmlContent = htmlContent.replace('Fail', 'Pass');

      // Change the grade 'F' to 'C' and grade point '0' to '5'
      htmlContent = htmlContent.replace(/<div class="cell" data-title="Grade">\s*F\s*<\/div>/g, '<div class="cell" data-title="Grade">C</div>');
      htmlContent = htmlContent.replace(/<div class="cell" data-title="Grade Point">\s*0\s*<\/div>/g, '<div class="cell" data-title="Grade Point">5</div>');

      // Count the number of "F" grades
      const fGrades = (htmlContent.match(/<div class="cell" data-title="Grade">\s*C\s*<\/div>/g) || []).length;

      // Calculate total credits and the difference
      const totalCredits = 20;
      const initialSecuredCreditsMatch = htmlContent.match(/<div class="cell" data-title="Credits Secured">\s*(\d+)\s*<\/div>/);
      const initialSecuredCredits = initialSecuredCreditsMatch ? parseInt(initialSecuredCreditsMatch[1], 10) : 0;

      const missingCredits = totalCredits - initialSecuredCredits;

      // Calculate new credit value for each "F" subject
      const newCreditValue = Math.floor(missingCredits / fGrades);

      // Replace credits for subjects that had "F"
      htmlContent = htmlContent.replace(/<div class="cell" data-title="Credits">\s*0\s*<\/div>/g, `<div class="cell" data-title="Credits">${newCreditValue}</div>`);

      // Update the HTML to set the secured credits to 20
      htmlContent = htmlContent.replace(/<div class="cell" data-title="Credits Secured">\s*\d+\s*<\/div>/, `<div class="cell" data-title="Credits Secured">${totalCredits}</div>`);

      // Calculate the SGPA according to a 10-point scale
      let totalGradePoints = 0;
      const gradePointMatches = htmlContent.match(/<div class="cell" data-title="Grade Point">\s*(\d+)\s*<\/div>/g);
      const creditMatches = htmlContent.match(/<div class="cell" data-title="Credits">\s*(\d+)\s*<\/div>/g);

      if (gradePointMatches && creditMatches) {
        gradePointMatches.forEach((match, index) => {
          const gradePoint = parseInt(match.match(/\d+/)[0], 10);
          const credit = parseInt(creditMatches[index].match(/\d+/)[0], 10);
          totalGradePoints += gradePoint * credit;
        });
      }

      const sgpa = (totalGradePoints / totalCredits).toFixed(2); // Calculate SGPA with 2 decimal precision

      // Add the SGPA to the HTML
      htmlContent = htmlContent.replace(/<div class="cell" data-title="SGPA">\s*-<\/div>/, `<div class="cell" data-title="SGPA">${sgpa}</div>`);
    }

    // Log the modified HTML content to the console
    console.log('Modified HTML Content:', htmlContent);

    // Send the modified HTML content as the response
    res.send(htmlContent);
  } catch (error) {
    console.error('Error sending POST request to the external URL:', error.message);
    res.status(500).send('Error processing the request');
  }
});

// Define a route with a dynamic parameter to match any hash ID after '/result/'
app.get('/result/:hashId', async (req, res) => {
  const hashId = req.params.hashId; // Extract hash ID from the URL
  console.log(`Hash ID: ${hashId}`); // Log the hash ID to the console

  const externalUrl = `https://results.jntuhceh.ac.in/result/${hashId}`;

  try {
    // Send a GET request to the external URL
    const response = await axios.get(externalUrl);
    const htmlContent = response.data; // Get the HTML content

    // Use a regular expression to find the string between getResult( and )
    const regex = /getResult\((\d+)\)/;
    const match = htmlContent.match(regex);

    if (match) {
      console.log(`Extracted String: ${match[1]}`); // Log the extracted string
    } else {
      console.log('No match found');
    }

    // Send the local HTML file as a response
    const filePath = path.join(__dirname, 'results', 'index.html');
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).send('404 Not Found');
      }
    });
  } catch (error) {
    console.error('Error fetching data from the external URL:', error.message);
    res.status(500).send('Error fetching data from the external URL');
  }
});

app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'index.html'); // Path to 'index.html' in the current directory

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error loading index.html:', err.message);
      res.status(404).send('404 Not Found');
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
